import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static'; // ดึงปลั๊กอินจากโค้ด 2 มาใช้
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';

const execAsync = promisify(exec);

// สร้างโฟลเดอร์ downloads อัตโนมัติถ้ายังไม่มี
if (!existsSync('./downloads')) {
  mkdirSync('./downloads');
}

const app = new Elysia()
  .use(cors()) 
  .use(staticPlugin({ assets: 'downloads', prefix: '/downloads' })) // เสิร์ฟไฟล์ตรงๆ ทำให้เซฟลงแฟลชไดร์ฟได้ 100%
  .post('/api/download', async ({ body, set }) => {
    const { url, format, quality } = body; 
    
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      set.status = 400;
      return { error: 'กรุณาระบุลิงก์ YouTube ที่ถูกต้อง' };
    }

    const targetFormat = format === 'mp4' ? 'mp4' : 'mp3';

    try {
      const { stdout: titleOutput } = await execAsync(`yt-dlp --extractor-args "youtube:player_client=android" --print title "${url}"`);
      const safeTitle = titleOutput.trim().replace(/[\\/:*?"<>|]/g, "_").substring(0, 80);
      
      const tempFilename = `${Date.now()}.${targetFormat}`;
      const outputFilename = `downloads/${tempFilename}`;
      
      let command = '';
      if (targetFormat === 'mp4') {
        let formatStr = quality === 'best' ? '"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"' 
                      : quality === 'worst' ? '"worstvideo[ext=mp4]+bestaudio[ext=m4a]/worst[ext=mp4]/worst"' 
                      : '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
        
        command = `yt-dlp --extractor-args "youtube:player_client=android" -f ${formatStr} --merge-output-format mp4 --embed-thumbnail --add-metadata --parse-metadata "NA:description" -o "${outputFilename}" "${url}"`;
      } else {
        command = `yt-dlp --extractor-args "youtube:player_client=android" -x --audio-format mp3 --embed-thumbnail --convert-thumbnails jpg --add-metadata --parse-metadata "NA:description" -o "${outputFilename}" "${url}"`;
      }

      console.log('กำลังดาวน์โหลด...', url);
      await execAsync(command);
      console.log('ดาวน์โหลดเสร็จสิ้น:', outputFilename);
      
      // เวลาลบไฟล์ทิ้งเป็น 1 นาที (60000 ms)
      setTimeout(async () => {
        try {
          if (existsSync(outputFilename)) {
            await unlink(outputFilename);
            console.log(`ลบไฟล์เรียบร้อย: ${outputFilename}`);
          }
        } catch (err) { }
      }, 60000);

      return { 
        success: true, 
        filename: tempFilename, 
        title: safeTitle,
        downloadUrl: `http://localhost:3000/downloads/${tempFilename}` // ส่งลิงก์ไฟล์ตรงๆ กลับไป
      };
      
    } catch (error: any) {
      console.error("🚨 YTDLP ERROR:", error?.message || error);
      set.status = 500;
      return { error: 'เกิดข้อผิดพลาดในการดาวน์โหลด' };
    }
  }, {
    body: t.Object({ 
      url: t.String(),
      format: t.Optional(t.String()),
      quality: t.Optional(t.String()) 
    })
  })
  .listen(3000);

console.log('🦊 Server running at http://localhost:3000');