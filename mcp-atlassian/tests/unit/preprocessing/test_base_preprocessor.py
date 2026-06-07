"""Unit tests for BasePreprocessor user mention helper methods."""

import pytest
from bs4 import BeautifulSoup

from mcp_atlassian.preprocessing.base import BasePreprocessor
from tests.utils.mocks import MockAtlassianClient


class MockConfluenceClient:
    """Mock Confluence client for user lookup testing."""

    def __init__(
        self,
        cloud_users: dict | None = None,
        server_users: dict | None = None,
        raise_on_lookup: bool = False,
    ):
        """
        Initialize mock client.

        Args:
            cloud_users: Dict mapping account IDs to user details (Cloud)
            server_users: Dict mapping userkeys to user details (Server/DC)
            raise_on_lookup: If True, raise exception on user lookup
        """
        self.cloud_users = cloud_users or {}
        self.server_users = server_users or {}
        self.raise_on_lookup = raise_on_lookup

    def get_user_details_by_accountid(self, account_id: str) -> dict:
        """Mock Cloud user lookup by account ID."""
        if self.raise_on_lookup:
            raise Exception("API error")
        if account_id in self.cloud_users:
            return self.cloud_users[account_id]
        raise Exception(f"User {account_id} not found")

    def get_user_details_by_userkey(self, userkey: str) -> dict:
        """Mock Server/DC user lookup by userkey."""
        if self.raise_on_lookup:
            raise Exception("API error")
        if userkey in self.server_users:
            return self.server_users[userkey]
        raise Exception(f"User {userkey} not found")


@pytest.fixture
def preprocessor():
    """Create BasePreprocessor instance."""
    return BasePreprocessor(base_url="https://confluence.example.com")


@pytest.fixture
def mock_cloud_client():
    """Create mock Confluence client with Cloud users."""
    return MockConfluenceClient(
        cloud_users={
            "account-123": {"displayName": "Test User One", "accountId": "account-123"},
            "account-456": {"displayName": "Test User Two", "accountId": "account-456"},
        }
    )


@pytest.fixture
def mock_server_client():
    """Create mock Confluence client with Server/DC users."""
    return MockConfluenceClient(
        server_users={
            "8a8186949dac8a11019db07b21810000": {
                "displayName": "Test User Three",
                "userkey": "8a8186949dac8a11019db07b21810000",
            },
            "8a8186949ca475ab019cfbdeaba60005": {
                "displayName": "Test User Four",
                "userkey": "8a8186949ca475ab019cfbdeaba60005",
            },
        }
    )


class TestExtractUserIdentifier:
    """Tests for _extract_user_identifier method."""

    def test_extract_cloud_account_id(self, preprocessor):
        """Test extracting account ID from Cloud user reference."""
        html = '<ri:user ri:account-id="account-123"/>'
        soup = BeautifulSoup(html, "html.parser")
        user_ref = soup.find("ri:user")

        user_identifier, is_cloud = preprocessor._extract_user_identifier(user_ref)

        assert user_identifier == "account-123"
        assert is_cloud is True

    def test_extract_server_userkey(self, preprocessor):
        """Test extracting userkey from Server/DC user reference."""
        html = '<ri:user ri:userkey="8a8186949dac8a11019db07b21810000"/>'
        soup = BeautifulSoup(html, "html.parser")
        user_ref = soup.find("ri:user")

        user_identifier, is_cloud = preprocessor._extract_user_identifier(user_ref)

        assert user_identifier == "8a8186949dac8a11019db07b21810000"
        assert is_cloud is False

    def test_extract_prefers_account_id_over_userkey(self, preprocessor):
        """Test that account ID takes precedence over userkey."""
        html = '<ri:user ri:account-id="account-123" ri:userkey="userkey-456"/>'
        soup = BeautifulSoup(html, "html.parser")
        user_ref = soup.find("ri:user")

        user_identifier, is_cloud = preprocessor._extract_user_identifier(user_ref)

        assert user_identifier == "account-123"
        assert is_cloud is True

    def test_extract_no_identifier(self, preprocessor):
        """Test extraction when no identifier is present."""
        html = "<ri:user/>"
        soup = BeautifulSoup(html, "html.parser")
        user_ref = soup.find("ri:user")

        user_identifier, is_cloud = preprocessor._extract_user_identifier(user_ref)

        assert user_identifier is None
        assert is_cloud is False


class TestExtractFallbackText:
    """Tests for _extract_fallback_text method."""

    def test_extract_from_link_body(self, preprocessor):
        """Test extracting text from ac:link-body."""
        html = """
        <ac:link>
            <ac:link-body>@Test User One</ac:link-body>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")
        user_element = soup.find("ac:link")

        fallback_text = preprocessor._extract_fallback_text(user_element)

        assert fallback_text == "@Test User One"

    def test_extract_from_plain_text_link_body(self, preprocessor):
        """Test extracting text from ac:plain-text-link-body."""
        html = """
        <ac:link>
            <ac:plain-text-link-body>Test User Generic Name</ac:plain-text-link-body>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")
        user_element = soup.find("ac:link")

        fallback_text = preprocessor._extract_fallback_text(user_element)

        assert fallback_text == "Test User Generic Name"

    def test_extract_link_body_takes_precedence(self, preprocessor):
        """Test that link-body takes precedence over plain-text-link-body."""
        html = """
        <ac:link>
            <ac:link-body>Link Body Text</ac:link-body>
            <ac:plain-text-link-body>Plain Text</ac:plain-text-link-body>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")
        user_element = soup.find("ac:link")

        fallback_text = preprocessor._extract_fallback_text(user_element)

        assert fallback_text == "Link Body Text"

    def test_extract_no_fallback(self, preprocessor):
        """Test extraction when no fallback text is present."""
        html = """
        <ac:link>
            <ri:user ri:account-id="account-123"/>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")
        user_element = soup.find("ac:link")

        fallback_text = preprocessor._extract_fallback_text(user_element)

        assert fallback_text is None


class TestLookupUserDisplayName:
    """Tests for _lookup_user_display_name method."""

    def test_lookup_cloud_user_success(self, preprocessor, mock_cloud_client):
        """Test successful Cloud user lookup."""
        display_name = preprocessor._lookup_user_display_name(
            user_identifier="account-123",
            is_cloud=True,
            confluence_client=mock_cloud_client,
        )

        assert display_name == "Test User One"

    def test_lookup_server_user_success(self, preprocessor, mock_server_client):
        """Test successful Server/DC user lookup."""
        display_name = preprocessor._lookup_user_display_name(
            user_identifier="8a8186949dac8a11019db07b21810000",
            is_cloud=False,
            confluence_client=mock_server_client,
        )

        assert display_name == "Test User Three"

    def test_lookup_user_not_found(self, preprocessor, mock_cloud_client):
        """Test lookup when user is not found."""
        display_name = preprocessor._lookup_user_display_name(
            user_identifier="unknown-user",
            is_cloud=True,
            confluence_client=mock_cloud_client,
        )

        assert display_name is None

    def test_lookup_no_client(self, preprocessor):
        """Test lookup when no client is provided."""
        display_name = preprocessor._lookup_user_display_name(
            user_identifier="account-123",
            is_cloud=True,
            confluence_client=None,
        )

        assert display_name is None

    def test_lookup_api_error(self, preprocessor):
        """Test lookup when API raises an exception."""
        error_client = MockConfluenceClient(raise_on_lookup=True)

        display_name = preprocessor._lookup_user_display_name(
            user_identifier="account-123",
            is_cloud=True,
            confluence_client=error_client,
        )

        assert display_name is None


class TestProcessUserMentionsInSoup:
    """Tests for _process_user_mentions_in_soup method."""

    def test_process_cloud_user_mention(self, preprocessor, mock_cloud_client):
        """Test processing Cloud user mention."""
        html = """
        <p>Hello <ac:link><ri:user ri:account-id="account-123"/></ac:link>!</p>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, mock_cloud_client)

        assert "@Test User One" in str(soup)

    def test_process_server_user_mention(self, preprocessor, mock_server_client):
        """Test processing Server/DC user mention."""
        html = """
        <p>Hello <ac:link><ri:user ri:userkey="8a8186949dac8a11019db07b21810000"/></ac:link>!</p>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, mock_server_client)

        assert "@Test User Three" in str(soup)

    def test_process_user_mention_with_fallback_text(self, preprocessor):
        """Test processing user mention with fallback text."""
        html = """
        <ac:link>
            <ri:user ri:account-id="unknown-account"/>
            <ac:plain-text-link-body>Test User Generic Name</ac:plain-text-link-body>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, confluence_client=None)

        assert "@Test User Generic Name" in str(soup)

    def test_process_user_mention_no_client_no_fallback(self, preprocessor):
        """Test processing user mention without client or fallback."""
        html = """
        <ac:link>
            <ri:user ri:account-id="account-123"/>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, confluence_client=None)

        assert "@user_account-123" in str(soup)

    def test_process_multiple_user_mentions(self, preprocessor, mock_cloud_client):
        """Test processing multiple user mentions."""
        html = """
        <p>
            <ac:link><ri:user ri:account-id="account-123"/></ac:link>
            and
            <ac:link><ri:user ri:account-id="account-456"/></ac:link>
        </p>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, mock_cloud_client)

        assert "@Test User One" in str(soup)
        assert "@Test User Two" in str(soup)

    def test_process_user_mention_not_found_uses_identifier(self, preprocessor, mock_cloud_client):
        """Test processing user mention when lookup fails."""
        html = """
        <ac:link>
            <ri:user ri:account-id="unknown-user"/>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, mock_cloud_client)

        assert "@user_unknown-user" in str(soup)

    def test_process_no_user_mentions(self, preprocessor, mock_cloud_client):
        """Test processing when no user mentions are present."""
        html = "<p>No user mentions here</p>"
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, mock_cloud_client)

        assert str(soup) == html

    def test_process_user_mention_missing_user_ref(self, preprocessor, mock_cloud_client):
        """Test processing when ac:link has no ri:user reference."""
        html = """
        <ac:link>
            <ac:link-body>Some Link</ac:link-body>
        </ac:link>
        """
        soup = BeautifulSoup(html, "html.parser")

        preprocessor._process_user_mentions_in_soup(soup, mock_cloud_client)

        # Should not crash, element should remain unchanged
        assert "Some Link" in str(soup)
