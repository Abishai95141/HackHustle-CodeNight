import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  onDecode: (text: string) => void;
  paused?: boolean;
};

type Cam = { id: string; label: string };

const ELEMENT_ID = 'qr-camera';

/**
 * Picks the best back-camera id from a list. Falls back to the first.
 * iOS Safari labels the rear lens variants differently across devices, so we
 * match a few common patterns rather than relying on a single label string.
 */
function pickRearCamera(cams: Cam[]): Cam | null {
  if (cams.length === 0) return null;
  const rxRear = /(back|rear|environment|camera2 0|wide angle camera|0,? facing back)/i;
  const rear = cams.find((c) => rxRear.test(c.label));
  return rear ?? cams[cams.length - 1] ?? cams[0];
}

export function QrCamera({ onDecode, paused = false }: Props) {
  const ref = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Cam[]>([]);
  const [activeCamId, setActiveCamId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const inst = ref.current;
      if (inst && inst.isScanning) {
        inst.stop().catch(() => {});
      }
    };
  }, []);

  async function ensureCameraList(): Promise<Cam[]> {
    // Some browsers only return labels AFTER permission has been granted.
    // We probe getUserMedia first so the device list comes back populated.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // Swallow — we'll surface a clearer error below if Html5Qrcode also fails.
    }
    const list = await Html5Qrcode.getCameras();
    const cams = list.map((c) => ({ id: c.id, label: c.label || 'Camera' }));
    setCameras(cams);
    return cams;
  }

  async function start(camId?: string) {
    setError(null);
    setStarting(true);

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStarting(false);
      setError(
        "Camera blocked: this page must be served over HTTPS (or localhost). Open the site over https:// and try again.",
      );
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStarting(false);
      setError('This browser does not expose a camera API. Try Chrome or Safari.');
      return;
    }

    try {
      const cams = cameras.length > 0 ? cameras : await ensureCameraList();
      const target = camId
        ? cams.find((c) => c.id === camId) ?? null
        : pickRearCamera(cams);

      const inst = new Html5Qrcode(ELEMENT_ID);
      ref.current = inst;

      // Prefer an exact device id when we have one (most reliable on iOS).
      // If no device id is available (rare desktop case) fall back to the
      // facingMode constraint with `ideal:` so it doesn't reject when there's
      // only a front-facing camera.
      const cameraConstraint: string | MediaTrackConstraints = target
        ? target.id
        : { facingMode: { ideal: 'environment' } };

      await inst.start(
        cameraConstraint,
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          // Hint that we want the rear lens; html5-qrcode forwards this as
          // `videoConstraints` to getUserMedia. iOS honours it.
          videoConstraints: target
            ? { deviceId: { exact: target.id } }
            : { facingMode: { ideal: 'environment' } },
        },
        (decoded) => {
          if (paused) return;
          const now = Date.now();
          if (lastRef.current.text === decoded && now - lastRef.current.at < 1500) return;
          lastRef.current = { text: decoded, at: now };
          onDecode(decoded);
        },
        () => {},
      );
      setActiveCamId(target?.id ?? null);
      setRunning(true);
    } catch (e: unknown) {
      console.error('QrCamera start failed', e);
      setError(humanizeCameraError(e));
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const inst = ref.current;
    if (inst && inst.isScanning) {
      await inst.stop();
    }
    setRunning(false);
  }

  async function switchCamera(nextId: string) {
    await stop();
    await start(nextId);
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        id={ELEMENT_ID}
        className="aspect-square w-full max-w-md overflow-hidden rounded-lg border border-border bg-secondary [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />
      {error ? (
        <div className="w-full max-w-md rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-2xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="outline" onClick={stop}>
            <CameraOff className="h-4 w-4" /> Stop camera
          </Button>
        ) : (
          <Button onClick={() => start()} disabled={starting}>
            <Camera className="h-4 w-4" /> {starting ? 'Starting…' : 'Start camera'}
          </Button>
        )}
        {running && cameras.length > 1 ? (
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-border bg-background py-2 pl-3 pr-8 text-2xs"
              value={activeCamId ?? ''}
              onChange={(e) => switchCamera(e.target.value)}
              aria-label="Switch camera"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function humanizeCameraError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name ?? '';
  const msg = e?.message ?? '';
  if (name === 'NotAllowedError' || /permission|denied/i.test(msg)) {
    return 'Camera permission denied. Tap the lock icon in your browser bar and allow Camera, then try again.';
  }
  if (name === 'NotFoundError' || /no.*camera|no.*device/i.test(msg)) {
    return 'No camera found on this device.';
  }
  if (name === 'NotReadableError' || /in use|hardware/i.test(msg)) {
    return 'Another app is using the camera. Close it and try again.';
  }
  if (name === 'OverconstrainedError') {
    return 'No matching camera was found. Try the camera selector if it appears below.';
  }
  if (name === 'SecurityError' || /secure context|insecure/i.test(msg)) {
    return 'Camera is blocked over plain HTTP — load the site over HTTPS.';
  }
  return msg ? `Camera failed to start: ${msg}` : 'Camera failed to start.';
}
