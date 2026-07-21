import {FontHandle} from "./font-engine.js";
import type {ShapeInput} from "./font-engine.js";

interface WorkerFont {
  readonly id: string;
  readonly url: string;
  readonly format: string;
  readonly sha256: string;
}

interface WorkerCase {
  readonly id: string;
  readonly fixtureId: string;
  readonly input: ShapeInput;
}

interface WorkerRequest {
  readonly fonts: readonly WorkerFont[];
  readonly cases: readonly WorkerCase[];
}

async function loadFont(font: WorkerFont): Promise<FontHandle> {
  const response = await fetch(font.url);
  if (!response.ok) throw new Error(`${response.status} loading ${font.url}`);
  return FontHandle.fromBytes(await response.arrayBuffer());
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    const startedAt = performance.now();
    const handles = new Map<string, FontHandle>();
    const formatMatrix: Record<string, {supported: boolean; reason?: string}> = {};
    for (const font of event.data.fonts) {
      try {
        handles.set(font.id, await loadFont(font));
        formatMatrix[font.format] = {supported: true};
      } catch (error) {
        formatMatrix[font.format] = {
          supported: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const shaping: Record<string, unknown> = {};
    for (const shapeCase of event.data.cases) {
      const handle = handles.get(shapeCase.fixtureId);
      if (!handle) throw new Error(`No loaded browser fixture: ${shapeCase.fixtureId}`);
      shaping[shapeCase.id] = handle.shape(shapeCase.input);
    }
    self.postMessage({
      result: {formatMatrix, shaping},
      measurements: {workerStartupAndRunMs: performance.now() - startedAt},
      environment: {runtime: navigator.userAgent},
    });
  })().catch((error: unknown) => {
    self.postMessage({error: error instanceof Error ? error.stack ?? error.message : String(error)});
  });
});

self.postMessage({ready: true});
