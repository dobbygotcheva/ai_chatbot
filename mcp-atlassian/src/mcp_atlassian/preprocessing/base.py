"""Base preprocessing module."""

import logging
import re
import urllib.parse
import warnings
from collections.abc import Callable
from typing import Any, Protocol

from bs4 import BeautifulSoup, Tag
from markdownify import markdownify as md

logger = logging.getLogger("mcp-atlassian")


def _extract_blocks(
    text: str,
    pattern: str,
    transform_fn: Callable[[re.Match[str]], str],
    storage: list[str],
    prefix: str,
    flags: int = 0,
) -> str:
    """Extract blocks matching pattern, transform, store, and replace with placeholders.

    Args:
        text: Input text to process.
        pattern: Regex pattern to match blocks.
        transform_fn: Function to transform the match into the target format.
        storage: List to store transformed blocks.
        prefix: Placeholder prefix (e.g., "CODEBLOCK").
        flags: Regex flags to pass to ``re.sub``.

    Returns:
        Text with blocks replaced by placeholders.
    """

    def _replacer(match: re.Match[str]) -> str:
        transformed = transform_fn(match)
        placeholder = f"\x00{prefix}{len(storage)}\x00"
        storage.append(transformed)
        return placeholder

    return re.sub(pattern, _replacer, text, flags=flags)


def _restore_blocks(text: str, storage: list[str], prefix: str) -> str:
    """Restore blocks from placeholders.

    Replaces in reverse order (highest index first) to avoid
    index collisions when placeholder text contains digits.

    Args:
        text: Text with placeholders.
        storage: List of stored blocks.
        prefix: Placeholder prefix used during extraction.

    Returns:
        Text with placeholders replaced by stored blocks.
    """
    for i in range(len(storage) - 1, -1, -1):
        text = text.replace(f"\x00{prefix}{i}\x00", storage[i])
    return text


class ConfluenceClient(Protocol):
    """Protocol for Confluence client."""

    def get_user_details_by_accountid(self, account_id: str) -> dict[str, Any]:
        """Get user details by account ID."""
        ...

    def get_user_details_by_userkey(self, userkey: str) -> dict[str, Any]:
        """Get user details by userkey (for Server/DC compatibility)."""
        ...


class BasePreprocessor:
    """Base class for text preprocessing operations."""

    def __init__(self, base_url: str = "") -> None:
        """
        Initialize the base text preprocessor.

        Args:
            base_url: Base URL for API server
        """
        self.base_url = base_url.rstrip("/") if base_url else ""

    def process_html_content(
        self,
        html_content: str,
        space_key: str = "",
        confluence_client: ConfluenceClient | None = None,
        content_id: str = "",
        attachments: list[dict[str, Any]] | None = None,
    ) -> tuple[str, str]:
        """
        Process HTML content to replace user refs and page links.

        Args:
            html_content: The HTML content to process
            space_key: Optional space key for context
            confluence_client: Optional Confluence client for user lookups
            content_id: Optional page/content ID for attachment URL
                construction
            attachments: Optional list of attachment dicts from
                Confluence API for URL lookup

        Returns:
            Tuple of (processed_html, processed_markdown)
        """
        try:
            # Parse the HTML content
            soup = BeautifulSoup(html_content, "html.parser")

            # Process user mentions
            self._process_user_mentions_in_soup(soup, confluence_client)
            self._process_user_profile_macros_in_soup(soup, confluence_client)

            self._process_images_in_soup(soup, content_id, attachments)
            self._process_time_tags_in_soup(soup)
            self._process_user_mention_links_in_soup(soup)
            processed_html = str(soup)
            processed_markdown = md(processed_html)

            return processed_html, processed_markdown

        except Exception as e:
            logger.error(f"Error in process_html_content: {str(e)}")
            raise

    def _extract_user_identifier(
        self, user_ref: Tag
    ) -> tuple[str | None, bool]:
        """
        Extract user identifier from ri:user element.
        
        Args:
            user_ref: The ri:user tag element
            
        Returns:
            Tuple of (user_identifier, is_cloud) where is_cloud indicates
            if account-id was used (True) or userkey (False)
        """
        account_id = user_ref.get("ri:account-id")
        userkey = user_ref.get("ri:userkey")
        
        is_cloud = account_id is not None
        user_identifier = account_id if is_cloud else userkey
        
        return user_identifier, is_cloud
    
    def _extract_fallback_text(self, user_element: Tag) -> str | None:
        """
        Extract fallback text from user mention element.
        
        Args:
            user_element: The ac:link element containing user mention
            
        Returns:
            Fallback text from link-body or plain-text-link-body if available
        """
        link_body = user_element.find("ac:link-body")
        if link_body:
            return link_body.get_text(strip=True)
        
        plain_text_body = user_element.find("ac:plain-text-link-body")
        if plain_text_body:
            return plain_text_body.get_text(strip=True)
        
        return None
    
    def _lookup_user_display_name(
        self,
        user_identifier: str,
        is_cloud: bool,
        confluence_client: ConfluenceClient | None,
    ) -> str | None:
        """
        Look up user display name by identifier.
        
        Args:
            user_identifier: Account ID (Cloud) or userkey (Server/DC)
            is_cloud: True for Cloud, False for Server/DC
            confluence_client: Confluence client for API calls
            
        Returns:
            Display name if found, None otherwise
        """
        if confluence_client is None:
            return None
            
        try:
            if is_cloud:
                user_details = confluence_client.get_user_details_by_accountid(
                    user_identifier
                )
            else:
                user_details = confluence_client.get_user_details_by_userkey(
                    user_identifier
                )
            return user_details.get("displayName")
        except Exception as e:
            logger.debug(f"User lookup failed for {user_identifier}: {e}")
            return None
    
    def _process_user_mentions_in_soup(
        self, soup: BeautifulSoup, confluence_client: ConfluenceClient | None = None
    ) -> None:
        """
        Process user mentions in BeautifulSoup object.

        Args:
            soup: BeautifulSoup object containing HTML
            confluence_client: Optional Confluence client for user lookups
        """
        user_mentions = soup.find_all("ac:link")

        for user_element in user_mentions:
            user_ref = user_element.find("ri:user")
            if not user_ref:
                continue
                
            user_identifier, is_cloud = self._extract_user_identifier(user_ref)
            
            if user_identifier and isinstance(user_identifier, str):
                fallback_text = self._extract_fallback_text(user_element)
                display_name = self._lookup_user_display_name(
                    user_identifier, is_cloud, confluence_client
                )
                
                if display_name:
                    user_element.replace_with(f"@{display_name}")
                elif fallback_text:
                    user_element.replace_with(f"@{fallback_text}")
                else:
                    user_element.replace_with(f"@user_{user_identifier}")

    def _process_user_profile_macros_in_soup(
        self, soup: BeautifulSoup, confluence_client: ConfluenceClient | None = None
    ) -> None:
        """
        Process Confluence User Profile macros in BeautifulSoup object.
        Replaces <ac:structured-macro ac:name="profile">...</ac:structured-macro>
        with the user's display name, typically formatted as @DisplayName.

        Args:
            soup: BeautifulSoup object containing HTML
            confluence_client: Optional Confluence client for user lookups
        """
        profile_macros = soup.find_all(
            "ac:structured-macro", attrs={"ac:name": "profile"}
        )

        for macro_element in profile_macros:
            user_param = macro_element.find("ac:parameter", attrs={"ac:name": "user"})
            if not user_param:
                logger.debug(
                    "User profile macro found without a 'user' parameter. Replacing with placeholder."
                )
                macro_element.replace_with("[User Profile Macro (Malformed)]")
                continue

            user_ref = user_param.find("ri:user")
            if not user_ref:
                logger.debug(
                    "User profile macro's 'user' parameter found without 'ri:user' tag. Replacing with placeholder."
                )
                macro_element.replace_with("[User Profile Macro (Malformed)]")
                continue

            account_id = user_ref.get("ri:account-id")
            userkey = user_ref.get("ri:userkey")
            
            is_cloud = account_id is not None
            user_identifier = account_id if is_cloud else userkey

            if user_identifier and isinstance(user_identifier, str):
                display_name = self._lookup_user_display_name(
                    user_identifier, is_cloud, confluence_client
                )
                
                if display_name:
                    macro_element.replace_with(f"@{display_name}")
                else:
                    fallback = user_identifier if user_identifier else "unknown_user"
                    macro_element.replace_with(f"[User Profile: {fallback}]")
            else:
                macro_element.replace_with("[User Profile Macro (Malformed)]")

    def _find_attachment_url(
        self,
        filename: str,
        attachments: list[dict[str, Any]] | None,
    ) -> str | None:
        """Find an attachment's download URL by filename.

        Args:
            filename: The attachment filename to look up
            attachments: List of attachment dicts from Confluence API

        Returns:
            The download URL if found, None otherwise
        """
        if not attachments:
            return None
        for att in attachments:
            if att.get("title") == filename:
                download = att.get("_links", {}).get("download")
                if download:
                    return str(download)
        return None

    def _process_time_tags_in_soup(self, soup: BeautifulSoup) -> None:
        """Process <time> tags to preserve date information.

        Confluence uses <time datetime="2026-04-20">20 Apr 2026</time>
        for dates. Without this, markdownify strips the tags and loses
        the date information.

        Args:
            soup: BeautifulSoup object containing HTML
        """
        for time_tag in soup.find_all("time"):
            datetime_val = time_tag.get("datetime", "")
            text_content = time_tag.get_text(strip=True)
            
            if datetime_val and text_content:
                replacement = f"{text_content} ({datetime_val})"
            elif datetime_val:
                replacement = datetime_val
            elif text_content:
                replacement = text_content
            else:
                replacement = ""
            
            time_tag.replace_with(replacement)

    def _process_user_mention_links_in_soup(self, soup: BeautifulSoup) -> None:
        """Process Confluence user mention links to preserve username.

        Confluence renders user mentions as <a class="confluence-userlink user-mention">
        with data-username attribute. Without this, markdownify converts them to plain
        links losing the @mention semantics.

        Args:
            soup: BeautifulSoup object containing HTML
        """
        user_links = soup.find_all("a", class_=lambda c: c and "user-mention" in str(c))
        
        for user_link in user_links:
            username = user_link.get("data-username", "")
            display_name = user_link.get_text(strip=True)
            
            if username:
                replacement = f"@{username}"
            elif display_name:
                replacement = f"@{display_name}"
            else:
                replacement = "@unknown-user"
            
            user_link.replace_with(replacement)

    def _process_images_in_soup(
        self,
        soup: BeautifulSoup,
        content_id: str = "",
        attachments: list[dict[str, Any]] | None = None,
    ) -> None:
        """Convert Confluence ac:image tags to standard HTML img tags.

        Args:
            soup: BeautifulSoup object containing HTML
            content_id: Optional page/content ID for fallback URL
            attachments: Optional attachment list for URL lookup
        """
        for ac_image in soup.find_all("ac:image"):
            src = ""
            alt = ""

            # Case 1: ri:attachment (file attached to the page)
            ri_att = ac_image.find("ri:attachment")
            if ri_att:
                filename = ri_att.get("ri:filename", "")
                alt = filename

                # Check if this references a different page
                is_cross_page = ri_att.find("ri:page") is not None

                # Try attachment list lookup first
                url = self._find_attachment_url(filename, attachments)
                if url:
                    # Prepend base_url if relative path
                    if url.startswith("/") and self.base_url:
                        src = f"{self.base_url}{url}"
                    else:
                        src = url
                elif content_id and not is_cross_page:
                    encoded = urllib.parse.quote(filename, safe="")
                    src = f"{self.base_url}/download/attachments/{content_id}/{encoded}"
                else:
                    src = filename
            else:
                # Case 2: ri:url (external URL)
                ri_url = ac_image.find("ri:url")
                if ri_url:
                    src = ri_url.get("ri:value", "")
                    # Extract filename from URL path for alt text
                    path = urllib.parse.urlparse(src).path
                    alt = path.rsplit("/", 1)[-1] if "/" in path else src
                else:
                    # Unknown inner element
                    logger.warning(
                        "ac:image tag with unsupported child: %s",
                        ac_image,
                    )
                    ac_image.replace_with("[unsupported image]")
                    continue

            # Build a standard <img> tag
            img_tag = soup.new_tag("img", src=src, alt=alt)

            # Preserve dimension attributes
            width = ac_image.get("ac:width")
            if width:
                img_tag["width"] = width
            height = ac_image.get("ac:height")
            if height:
                img_tag["height"] = height

            ac_image.replace_with(img_tag)

    def _convert_html_to_markdown(self, text: str) -> str:
        """Convert HTML content to markdown if needed.

        Protects markdown code spans (fenced and inline) from being
        interpreted as HTML by BeautifulSoup before conversion.
        """
        # Protect fenced code blocks and inline code from HTML parsing
        code_blocks: list[str] = []
        inline_codes: list[str] = []

        text = _extract_blocks(
            text,
            r"```[^\n]*\n[\s\S]*?\n```",
            lambda m: m.group(0),
            code_blocks,
            "HTMLCVTBLOCK",
        )
        text = _extract_blocks(
            text,
            r"`[^`]+`",
            lambda m: m.group(0),
            inline_codes,
            "HTMLCVTINLINE",
        )

        if re.search(r"<[^>]+>", text):
            try:
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", category=UserWarning)
                    soup = BeautifulSoup(f"<div>{text}</div>", "html.parser")
                    html = str(soup.div.decode_contents()) if soup.div else text
                    text = md(html)
            except Exception as e:
                logger.warning(f"Error converting HTML to markdown: {str(e)}")

        # Restore in reverse order: inline first, then blocks
        text = _restore_blocks(text, inline_codes, "HTMLCVTINLINE")
        text = _restore_blocks(text, code_blocks, "HTMLCVTBLOCK")
        return text
