import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import TTSPage from "@/pages/TTS";
import VoiceClonePage from "@/pages/VoiceClone";
import RealTimePage from "@/pages/RealTime";
import StoryEditorPage from "@/pages/StoryEditor";
import VoiceLibraryPage from "@/pages/VoiceLibrary";
import SettingsPage from "@/pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/tts" replace />} />
          <Route path="tts" element={<TTSPage />} />
          <Route path="voice-clone" element={<VoiceClonePage />} />
          <Route path="realtime" element={<RealTimePage />} />
          <Route path="story" element={<StoryEditorPage />} />
          <Route path="library" element={<VoiceLibraryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
