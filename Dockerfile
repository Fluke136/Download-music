# ใช้ระบบปฏิบัติการที่มี Bun ติดตั้งมาให้แล้ว
FROM oven/bun:1

WORKDIR /app

# ติดตั้ง Python และ FFmpeg
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl

# ดาวน์โหลด yt-dlp เวอร์ชันล่าสุด
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

# ติดตั้ง mutagen สำหรับจัดการหน้าปกเพลง
RUN pip3 install mutagen --break-system-packages || pip3 install mutagen

# ก๊อปปี้ไฟล์โค้ดและติดตั้ง dependencies
COPY package.json ./
RUN bun install

# ก๊อปปี้ไฟล์ทั้งหมดไปไว้ในเซิร์ฟเวอร์
COPY . .

# กำหนด Port
ENV PORT=3000
EXPOSE 3000

# คำสั่งรันเซิร์ฟเวอร์เมื่อเปิดเครื่อง
CMD ["bun", "run", "index.ts"]