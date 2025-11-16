# blockme

A smart productivity Chrome extension that combines the Pomodoro technique with intelligent website blocking, progress tracking, motivational quotes, and puzzles. Designed to help users stay focused, avoid distractions, and build long-term productive habits.

---

## 🚀 Features

### 🔒 Smart Website Blocking
- Add any distracting website (e.g., youtube.com, instagram.com).
- Automatically blocks these sites only **during focus sessions**.
- Redirects them to a custom **blocked page** with:
  - A live countdown timer  
  - Motivational quotes  
  - Random puzzles/riddles  

### ⏳ Pomodoro Timer
- Fully customizable:
  - Focus time  
  - Short break  
  - Long break  
- Demo-friendly fast timer options (1 min focus, ~20s short break, ~40s long break).
- Optional **Auto-loop** to automatically cycle:

### 🏆 XP, Streaks & Badges
- Earn **XP** for each completed focus session.
- Build a **daily streak** when you focus on consecutive days.
- Unlock **badges** for milestones such as:
- First Focus  
- 5 Sessions  
- 3-Day Streak  
- 300 XP  

### 📊 Stats Dashboard (inside popup)
- View:
- Current streak  
- Total XP  
- Sessions completed  
- Earned badges  

### 🎯 Beautiful UI/UX
- Clean dark theme  
- Smooth timer display  
- Modern cards and layout  
- Simple blocklist manager  

---

## 📸 Screenshot
### Blocked Page
![Blocked Page](https://github.com/YashasBC21/blockme/blob/main/display.jpg)

## 🛠️ Tech Stack

| Component | Technology |
|----------|------------|
| UI | HTML, CSS, JS |
| Popup Logic | JavaScript |
| Storage | Chrome Storage API |
| Blocking | Declarative Net Request API |
| Timer | Chrome Alarms API |
| Notifications | Chrome Notifications API |
| Build | No framework, pure JS |
| Data | JSON (quotes + puzzles) |

---

## 📦 Installation

### 1. Download or clone the repository
```sh
git clone https://github.com/YASHASBC21/blockme
2. Open Chrome Extensions

Visit:

chrome://extensions

3. Enable Developer Mode

Toggle it ON in the top-right corner.

4. Load Unpacked

Click:

Load unpacked


Select the project folder:

blockme