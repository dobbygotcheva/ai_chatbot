import type { ChatMessage } from "@/lib/types";
import type { CodeExecutionImage } from "@/lib/types/code-execution";

function isBase64ImageData(str: string): boolean {
  return /^data:image\/\w+;base64,/.test(str);
}

function isRawBase64(str: string): boolean {
  if (str.length <= 50) {
    return false;
  }

  if (str.startsWith("http://") || str.startsWith("https://")) {
    return false;
  }

  if (str.startsWith("data:")) {
    return false;
  }

  return /^[A-Za-z0-9+/]+={0,2}$/.test(str);
}

export function filterBase64FromToolResults(
  messages: ChatMessage[]
): ChatMessage[] {
  return messages.map((message) => {
    if (!message.parts || message.parts.length === 0) {
      return message;
    }

    const filteredParts = message.parts.map((part) => {
      if (
        part.type === "tool-executeCode" &&
        part.state === "output-available"
      ) {
        const output = part.output as Record<string, unknown> | undefined;
        if (!output) {
          return part;
        }

        const images = output.images as CodeExecutionImage[] | undefined;
        if (images && Array.isArray(images)) {
          const filteredImages = images.map((image) => {
            if (
              isBase64ImageData(image.content) ||
              isRawBase64(image.content)
            ) {
              return {
                ...image,
                content: "",
              };
            }
            return image;
          });

          return {
            ...part,
            output: {
              ...output,
              images: filteredImages,
            },
          } as typeof part;
        }
      }

      return part;
    });

    return {
      ...message,
      parts: filteredParts,
    };
  });
}
