@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   ไม่พบ Node.js ในเครื่องนี้
  echo   ดาวน์โหลดได้ที่ https://nodejs.org/  แล้วติดตั้งก่อน
  echo.
  pause
  exit /b 1
)
echo.
echo   กำลังเปิดเซิร์ฟเวอร์ทดสอบ...
echo   หากเบราว์เซอร์ไม่เปิดเอง ให้เข้า http://localhost:5173
echo.
start "" http://localhost:5173
node serve.js
pause
