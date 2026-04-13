# HephasBot

![HephasBot](public/logo.svg)

**HephasBot** is a modern, browser-based control interface for robotic arms, specifically designed for the **Hephas** ecosystem. Built with **Next.js** and **WebSerial**, it allows you to connect to, calibrate, and control robots directly from Chrome or Edge capabilities without installing complex native drivers.

## 🚀 Key Features

- **🔌 Browser-Native Control**: Connect to robots directly using the WebSerial API. No backend servers or native drivers required for basic operation.
- **🕹️ Gamepad Support**: Plug-and-play support for gamepads (Xbox, PlayStation, etc.) with a built-in visualizer.
- **🤖 Multi-Robot Fleet**: Connect and manage multiple robots simultaneously.
  - **Leader-Follower Sync**: Control multiple robots in sync with a single input source.
- **🔧 Built-in Calibration**: Guided calibration wizards to set joint limits and optimize hardware performance.
- **📼 Record & Playback**: Record joint trajectories and replay them with precision.
- **💻 Terminal Integration**: Embedded xterm.js terminal for direct debugging and log monitoring.
- **⌨️ Visual Keyboard**: On-screen accessibility controls.
- **⚡ Modern UI**: sleek, responsive dark-mode interface built with **Shadcn/UI** and **Tailwind CSS v4**.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [Shadcn/UI](https://ui.shadcn.com/)
- **State Management**: React Context + Hooks
- **Hardware Interface**: WebSerial API

## 🏁 Getting Started

Go to www.hephasbot.com to try it out. If you want to clone it read below.

### Prerequisites

- **Node.js**: v18+ recommended
- **Bun**: This project uses [Bun](https://bun.sh/) for package management and scripts.
- **Browser**: Chrome, Edge, or Opera (any browser with WebSerial support).

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Adityaki37/Hephas.git
    cd Hephas/hephasbot
    ```

2.  **Install dependencies**:
    ```bash
    bun install
    ```

3.  **Run the App**:
    ```bash
    bun run dev
    ```

### Running Locally

Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### Connecting a Robot
1.  Connect your Hephas robot (or compatible STS3215/ESP32 based arm) via USB.
2.  Click **"Connect Robot"** in the Command Center.
3.  Select the correct COM port from the browser popup.
4.  Once connected, the robot status will change to "Online".

### Controls
- **Sliders**: Adjust individual joint angles directly.
- **Gamepad**: Connect a controller and press any button to activate. Use joysticks for intuitive control.
- **Keyboard**:
  - `W` / `S`: Pitch/Forward
  - `A` / `D`: Rotate Base
  - `Arrow Keys`: Fine adjustments
- **Terminal**: Use the integrated terminal for lower-level debugging logs.

### Calibration
If the robot joints are not mapped correctly:
1.  Click **"Start Calibration"**.
2.  Follow the on-screen prompts to move joints to their limits.
3.  Click **"Finish"** to save the new calibration ranges to the robot's EEPROM (if supported) or local session.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
