# 🎮 Clypse - Share Worthy Video Gallery

Clypse is a self-hosted, lightweight video gallery built for gaming highlights, montages, and clips.  
It features auto-thumbnails, smooth streaming, with modern UI to make your content instantly shareable.

---

## 🔍 Preview

<table>
  <tr>
    <td><img src="https://files.catbox.moe/qxxkvo.png" alt="App Preview" width="400"/></td>
    <td><img src="https://files.catbox.moe/lm5vyl.png" alt="App Preview" width="400"/></td>
  </tr>
</table>

---

## ✨ Features

- ⬆️ **Easy Uploads** – Drag & drop or pick a file, progress bar included.  
- 🎞️ **Auto Thumbnailing** – Each video gets its own snapshot via FFmpeg.  
- 🚀 **Smooth Streaming** – Range-based streaming for instant play.  
- 🔗 **Social Ready** – Rich embeds for Discord, Twitter, and more.  
- 🔄 **Real-time Updates** – Instantly visible to all connected users with WebSockets.  
- 📦 **Self-Hosted** – Full ownership of your videos, simple to run in Docker.  
- 🗂 **Persistent Metadata** – All clip info stored in SQLite.  

---

## 🚀 Installation

### 🔧 Prerequisites
- Docker & Docker Compose (recommended)  
- Node.js (for dev setup)  
- FFmpeg (for dev setup)  

### ▶️ Run with Docker (Recommended)

1. Create `docker-compose.yml`:

    ```yaml
    services:
      clypse:
        image: ghcr.io/raw-network/clypse:latest
        container_name: clypse
        ports:
          - 3000:3000
        volumes:
          - ./data:/data
          - ./videos:/videos
          - ./uploads:/uploads
        environment:
          - TZ=UTC
          - MAX_UPLOAD_SIZE=1G
          - MAX_UPLOAD_COUNT=1
        restart: unless-stopped
    ```

2. Start the container:
    ```bash
    docker compose up -d
    ```

3. Visit:
    ```
    http://localhost:3000
    ```

4. Stop the app:
    ```bash
    docker compose down
    ```

---

## ⚙️ Configuration

Customize behavior with environment variables.

| Variable          | Description                     | Default  |
|-------------------|---------------------------------|----------|
| `TZ`              | Timezone for container          | UTC      |
| `MAX_UPLOAD_SIZE` | Max upload size for video files | No Limit |
| `MAX_UPLOAD_COUNT`| Max upload file in one sesion   | No Limit |

---

## 💻 Local Development (Node.js)

1. Install FFmpeg:
    ```bash
    ffmpeg -version
    ```
2. Clone repo:
    ```bash
    git clone https://github.com/RAW-Network/clypse.git
    cd clypse
    ```
3. Install deps:
    ```bash
    npm install
    ```
4. Run dev server:
    ```bash
    npm run dev
    ```
5. Open: `http://localhost:3000`

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, WebSocket  
- **Frontend**: HTML, CSS, Vanilla JS  
- **Video Processing**: FFmpeg  
- **Database**: SQLite  
- **Containerization**: Docker & Compose  

---

## 📄 License

This project is licensed under the **MIT License**.
See the [LICENSE](./LICENSE) file for details.