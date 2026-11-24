import { Vibrate, Volume2 } from "lucide-react";
import { playFeedback, useFeedbackSettings } from "@/lib/feedback";
import { Button } from "./ui";

export function FeedbackSettings() {
  const { sound, haptics, volume } = useFeedbackSettings();

  return (
    <fieldset className="feedback-settings" data-feedback="off">
      <legend>Respuesta al tocar</legend>
      <label className="feedback-setting">
        <Volume2 aria-hidden="true" className="size-5" />
        <span>Sonidos de la app</span>
        <input
          type="checkbox"
          role="switch"
          className="clay-switch"
          checked={sound}
          onChange={(event) => {
            const enabled = event.target.checked;
            useFeedbackSettings.setState({ sound: enabled });
            if (enabled) playFeedback("tap", "sound");
          }}
        />
      </label>
      <label className="feedback-volume">
        <span>Volumen de efectos</span>
        <output>{volume}%</output>
        <input
          type="range"
          aria-label="Volumen de efectos"
          min={0}
          max={100}
          step={5}
          value={volume}
          disabled={!sound}
          onChange={(event) => useFeedbackSettings.setState({ volume: event.target.valueAsNumber })}
        />
      </label>
      <label className="feedback-setting">
        <Vibrate aria-hidden="true" className="size-5" />
        <span>Vibración al tocar</span>
        <input
          type="checkbox"
          role="switch"
          className="clay-switch"
          checked={haptics}
          onChange={(event) => {
            const enabled = event.target.checked;
            useFeedbackSettings.setState({ haptics: enabled });
            if (enabled) playFeedback("select", "haptic");
            else navigator.vibrate?.(0);
          }}
        />
      </label>
      <Button
        variant="quiet"
        full
        disabled={!haptics && (!sound || volume === 0)}
        onClick={() => playFeedback("confirm")}
      >
        Probar efectos
      </Button>
    </fieldset>
  );
}
