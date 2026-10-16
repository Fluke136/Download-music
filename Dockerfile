FROM oven/bun:1
WORKDIR /app

# ติดตั้งแพ็กเกจที่จำเป็น: ffmpeg, python และให้สิทธิ์ yt-dlp ทำงานได้
RUN apt-get update && apt-get install -y curl python3 ffmpeg
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

COPY package.json ./
RUN bun install
COPY . .

EXPOSE 3000
CMD ["bun", "run", "index.ts"]