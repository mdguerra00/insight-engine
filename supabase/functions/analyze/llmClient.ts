export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

type GenerateMarkdownParams = {
  messages: LlmMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
};

type GenerateJsonParams = {
  messages: LlmMessage[];
  model?: string;
};

type OpenAiChatCompletionChunk = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAIConfig = {
  apiKey?: string;
  extractionModel?: string;
  reportModel?: string;
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_EXTRACTION_MODEL = "gpt-4.1-mini";
const DEFAULT_REPORT_MODEL = "gpt-4.1";

export function createLlmClient(config: OpenAIConfig = {}) {
  const apiKey = config.apiKey ?? Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const extractionModel = config.extractionModel ?? Deno.env.get("OPENAI_MODEL_EXTRACTION") ?? DEFAULT_EXTRACTION_MODEL;
  const reportModel = config.reportModel ?? Deno.env.get("OPENAI_MODEL_REPORT") ?? DEFAULT_REPORT_MODEL;

  const DEFAULT_TIMEOUT_MS = 180_000; // 3 minutes

  async function callOpenAI(body: Record<string, unknown>, timeoutMs?: number) {
    return fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  }

  return {
    models: {
      extraction: extractionModel,
      report: reportModel,
    },

    async generateMarkdown(params: GenerateMarkdownParams) {
      try {
        return await callOpenAI(
          {
            model: params.model ?? reportModel,
            messages: params.messages,
            stream: params.stream ?? true,
            temperature: params.temperature ?? 0.3,
          },
          300_000, // 5 min for report generation (streaming)
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "TimeoutError") {
          throw new Error("Timeout: a geração do relatório excedeu 5 minutos.");
        }
        throw err;
      }
    },

    async generateJson<T>(params: GenerateJsonParams): Promise<T> {
      let response: Response;
      try {
        response = await callOpenAI({
          model: params.model ?? extractionModel,
          messages: params.messages,
          response_format: { type: "json_object" },
          stream: false,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "TimeoutError") {
          throw new Error("Timeout: a chamada LLM excedeu 3 minutos. Tente com documentos menores.");
        }
        throw err;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI JSON generation failed (${response.status}): ${body}`);
      }

      const payload = await response.json() as OpenAiChatCompletionChunk;
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI returned an empty JSON response");
      }

      return JSON.parse(content) as T;
    },
  };
}
