#!/bin/sh
# languages.jsx ถูกรวมเข้า ./build-react.sh แล้ว (คอมไพล์ JSX ทั้ง 4 หน้า + Tailwind ในครั้งเดียว)
# ไฟล์นี้คงไว้เพื่อให้คำสั่งเดิมยังใช้ได้ — ทำงานเหมือนกันทุกประการ
exec "$(dirname "$0")/build-react.sh"
