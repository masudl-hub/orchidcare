import { useRef, useCallback } from 'react';

export interface CallRecordingBlobs {
  userBlob: Blob | null;
  agentBlob: Blob | null;
}

const MIME_TYPE = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/webm';

export function useCallRecorder() {
  const userRecorderRef = useRef<MediaRecorder | null>(null);
  const agentRecorderRef = useRef<MediaRecorder | null>(null);
  const userChunksRef = useRef<Blob[]>([]);
  const agentChunksRef = useRef<Blob[]>([]);
  const blobsRef = useRef<CallRecordingBlobs>({ userBlob: null, agentBlob: null });
  const recordingRef = useRef(false);

  const startRecording = useCallback((micStream: MediaStream | null, agentStream: MediaStream | undefined | null) => {
    if (recordingRef.current) return;

    userChunksRef.current = [];
    agentChunksRef.current = [];
    blobsRef.current = { userBlob: null, agentBlob: null };

    try {
      if (micStream) {
        const ur = new MediaRecorder(micStream, { mimeType: MIME_TYPE });
        ur.ondataavailable = (e) => {
          if (e.data.size > 0) userChunksRef.current.push(e.data);
        };
        ur.start(1000); // 1s timeslice
        userRecorderRef.current = ur;
      }

      if (agentStream) {
        const ar = new MediaRecorder(agentStream, { mimeType: MIME_TYPE });
        ar.ondataavailable = (e) => {
          if (e.data.size > 0) agentChunksRef.current.push(e.data);
        };
        ar.start(1000);
        agentRecorderRef.current = ar;
      }

      recordingRef.current = true;
      console.log('[CallRecorder] started', {
        user: !!micStream,
        agent: !!agentStream,
        mimeType: MIME_TYPE,
      });
    } catch (err) {
      console.warn('[CallRecorder] start failed (non-fatal):', err);
    }
  }, []);

  const stopRecording = useCallback((): Promise<CallRecordingBlobs> => {
    if (!recordingRef.current) {
      return Promise.resolve(blobsRef.current);
    }
    recordingRef.current = false;

    const promises: Promise<void>[] = [];

    if (userRecorderRef.current && userRecorderRef.current.state !== 'inactive') {
      promises.push(new Promise<void>((resolve) => {
        userRecorderRef.current!.onstop = () => {
          blobsRef.current.userBlob = new Blob(userChunksRef.current, { type: MIME_TYPE });
          console.log(`[CallRecorder] user blob: ${(blobsRef.current.userBlob.size / 1024).toFixed(1)} KB`);
          resolve();
        };
        userRecorderRef.current!.stop();
      }));
    }

    if (agentRecorderRef.current && agentRecorderRef.current.state !== 'inactive') {
      promises.push(new Promise<void>((resolve) => {
        agentRecorderRef.current!.onstop = () => {
          blobsRef.current.agentBlob = new Blob(agentChunksRef.current, { type: MIME_TYPE });
          console.log(`[CallRecorder] agent blob: ${(blobsRef.current.agentBlob.size / 1024).toFixed(1)} KB`);
          resolve();
        };
        agentRecorderRef.current!.stop();
      }));
    }

    return Promise.all(promises).then(() => {
      userRecorderRef.current = null;
      agentRecorderRef.current = null;
      return blobsRef.current;
    });
  }, []);

  const getBlobs = useCallback((): CallRecordingBlobs => blobsRef.current, []);

  return { startRecording, stopRecording, getBlobs };
}
