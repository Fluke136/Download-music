FROM oven/bun:1
WORKDIR /app

# เพิ่ม nodejs เพื่อให้ yt-dlp แก้ปริศนา JavaScript ของ YouTube ได้
RUN apt-get update && apt-get install -y curl python3 ffmpeg nodejs
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

COPY package.json ./
RUN bun install
COPY . .

EXPOSE 3000
CMD ["bun", "run", "index.ts"]