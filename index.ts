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
    const { url, format, quality } = body; 
    
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      set.status = 400;
      return { error: 'กรุณาระบุลิงก์ YouTube ที่ถูกต้อง' };
    }

    const targetFormat = format === 'mp4' ? 'mp4' : 'mp3';

    try {
      // ดึงชื่อคลิป (ใส่ตัวหลบแบน Android)
      const { stdout: titleOutput } = await execAsync(`yt-dlp --extractor-args "youtube:player_client=android" --print title "${url}"`);
      const safeTitle = titleOutput.trim().replace(/[\\/:*?"<>|]/g, "_").substring(0, 80);
      
      const tempFilename = `${Date.now()}.${targetFormat}`;
      const outputFilename = `downloads/${tempFilename}`;
      
      let command = '';
      if (targetFormat === 'mp4') {
        let formatStr = '';
        if (quality === 'best') {
          formatStr = '"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
        } else if (quality === 'worst') {
          formatStr = '"worstvideo[ext=mp4]+bestaudio[ext=m4a]/worst[ext=mp4]/worst"';
        } else {
          formatStr = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
        }
        
        command = `yt-dlp --extractor-args "youtube:player_client=android" -f ${formatStr} --merge-output-format mp4 --embed-thumbnail --add-metadata --parse-metadata "NA:description" -o "${outputFilename}" "${url}"`;
      } else {
        command = `yt-dlp --extractor-args "youtube:player_client=android" -x --audio-format mp3 --embed-thumbnail --convert-thumbnails jpg --add-metadata --parse-metadata "NA:description" -o "${outputFilename}" "${url}"`;
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
      return { error: 'เกิดข้อผิดพลาดในการดาวน์โหลด' };
    }
  }, {
    body: t.Object({ 
      url: t.String(),
      format: t.Optional(t.String()),
      quality: t.Optional(t.String()) 
    })
  })
  .get('/api/file/:filename', ({ params, query }) => {
    const filePath = `downloads/${params.filename}`;
    const file = Bun.file(filePath);
    const title = query.title || 'download';
    
    const ext = params.filename.split('.').pop() || 'mp3';
    const encodedTitle = encodeURIComponent(`${title}.${ext}`);
    
    // ยืดเวลาลบไฟล์ขยะเป็น 1 นาที ป้องกันไฟล์โดนลบตอนยังโหลดลงเครื่องไม่เสร็จ
    setTimeout(async () => {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
          console.log(`ลบไฟล์เรียบร้อย: ${filePath}`);
        }
      } catch (err) { }
    }, 60000); // 60000 ms = 1 นาที

    // แก้ไขการบังคับดาวน์โหลดให้ชัวร์ 100% โดยใช้ new Response ยัด Header
    return new Response(file, {
      headers: {
        'Content-Type': ext === 'mp4' ? 'video/mp4' : 'audio/mpeg',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedTitle}`
      }
    });
  })
  .listen(3000);

console.log('🦊 Server running at port 3000');