// Unique Device Identity and Audio Alarm Utility for UDP Alert System

export function getDeviceId() {
  let id = localStorage.getItem("udpDeviceId");
  if (!id) {
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timePart = Date.now().toString(36).slice(-4).toUpperCase();
    id = `DEV-${randPart}-${timePart}`;
    localStorage.setItem("udpDeviceId", id);
  }
  return id;
}

export function getDeviceName() {
  let name = localStorage.getItem("udpDeviceName");
  if (!name) {
    const ua = navigator.userAgent;
    let base = "Client Device";
    if (/android/i.test(ua)) base = "Android Mobile";
    else if (/iphone|ipad|ipod/i.test(ua)) base = "Apple Mobile";
    else if (/windows/i.test(ua)) base = "Windows PC";
    else if (/macintosh|mac os x/i.test(ua)) base = "Mac Device";
    else if (/linux/i.test(ua)) base = "Linux Terminal";

    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    name = `${base} (${suffix})`;
    localStorage.setItem("udpDeviceName", name);
  }
  return name;
}

export function setDeviceName(name) {
  if (name && name.trim()) {
    localStorage.setItem("udpDeviceName", name.trim());
  }
}

// Synthesize alarm sound using browser Web Audio API (100% offline & zero asset dependencies)
export function playEmergencyAlarm(priority = "HIGH") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (priority === "HIGH") {
      // Emergency two-tone siren
      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.12, ctx.currentTime);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(587, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);
      osc.frequency.setValueAtTime(587, now + 0.45);
      osc.frequency.setValueAtTime(880, now + 0.6);
      osc.frequency.setValueAtTime(587, now + 0.75);

      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.1);
    } else {
      // Notice chime
      osc.type = "sine";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (err) {
    console.warn("Audio Context playback prevented:", err);
  }
}

// Browser desktop notification
export function sendDesktopNotification(title, message) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(`🚨 ${title}`, {
        body: message,
        icon: "/favicon.ico"
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(`🚨 ${title}`, {
            body: message,
            icon: "/favicon.ico"
          });
        }
      });
    }
  } catch (err) {
    // Notification error suppressed
  }
}
