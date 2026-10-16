import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';

const execAsync = promisify(exec);

if (!existsSync('./downloads')) {
  mkdirSync('./downloads');
}

const app = new Elysia()
  .use(cors()) 
  .post('/api/download', async ({ body, set }) => {
    // รับค่า quality เข้ามาเพิ่ม
    const { url, format, quality } = body; 
    
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      set.status = 400;
      return { error: 'กรุณาระบุลิงก์ YouTube ที่ถูกต้อง' };
    }

    const targetFormat = format === 'mp4' ? 'mp4' : 'mp3';

    try {
      const { stdout: titleOutput } = await execAsync(`yt-dlp --print title "${url}"`);
      const safeTitle = titleOutput.trim().replace(/[\\/:*?"<>|]/g, "_").substring(0, 80);
      
      const tempFilename = `${Date.now()}.${targetFormat}`;
      const outputFilename = `downloads/${tempFilename}`;
      
      let command = '';
      if (targetFormat === 'mp4') {
        // กำหนดคุณภาพตามที่เลือก
        let formatStr = '';
        if (quality === 'best') {
          // ชัดสุดเท่าที่มี (4K/8K)
          formatStr = '"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
        } else if (quality === 'worst') {
          // ภาพต่ำสุด (แต่ใช้เสียงดีสุดเท่าที่ทำได้ในรูปแบบที่เข้ากัน)
          formatStr = '"worstvideo[ext=mp4]+bestaudio[ext=m4a]/worst[ext=mp4]/worst"';
        } else {
          // auto (แนะนำ): สูงสุดไม่เกิน 1080p
          formatStr = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
        }
        
        command = `yt-dlp -f ${formatStr} --merge-output-format mp4 --embed-thumbnail --add-metadata --parse-metadata "NA:description" -o "${outputFilename}" "${url}"`;
      } else {
        command = `yt-dlp -x --audio-format mp3 --embed-thumbnail --convert-thumbnails jpg --add-metadata --parse-metadata "NA:description" -o "${outputFilename}" "${url}"`;
      }

      await execAsync(command);
      
      return { 
        success: true, 
        filename: tempFilename, 
        title: safeTitle 
      };
      
    } catch (error: any) {
      console.error("🚨 YTDLP ERROR:", error?.message || error);
      set.status = 400; 
      return { error: `ขัดข้องทางเทคนิค: ${error?.message || 'ไม่สามารถแปลงไฟล์ได้'}` };
    }
  }, {
    body: t.Object({ 
      url: t.String(),
      format: t.Optional(t.String()),
      quality: t.Optional(t.String()) // อนุญาตให้ส่งค่า quality มาได้
    })
  })
  .get('/api/file/:filename', ({ params, query, set }) => {
    const filePath = `downloads/${params.filename}`;
    const file = Bun.file(filePath);
    const title = query.title || 'download';
    
    const ext = params.filename.split('.').pop() || 'mp3';
    const encodedTitle = encodeURIComponent(`${title}.${ext}`);
    
    set.headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodedTitle}`;
    set.headers['Content-Type'] = ext === 'mp4' ? 'video/mp4' : 'audio/mpeg';

    setTimeout(async () => {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
          console.log(`ลบไฟล์ขยะเรียบร้อย: ${filePath}`);
        }
      } catch (err) {
        console.error(`ไม่สามารถลบไฟล์ได้: ${filePath}`, err);
      }
    }, 60000);

    return file;
  })
  const port = process.env.PORT || 3000;
  app.listen(port);

console.log(`🦊 Server running at port ${port}`);