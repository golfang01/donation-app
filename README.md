# Donation Platform 

📝 **About the Project**
แพลตฟอร์มรับบริจาคสำหรับสตรีมเมอร์ (กำลังอยู่ในช่วงพัฒนา) โดยโปรเจกต์นี้ให้ความสำคัญกับการทำ Automated Testing ควบคู่ไปกับการพัฒนา (Shift-Left Testing) เพื่อควบคุมคุณภาพของระบบตั้งแต่เริ่มต้น

---

## 🛠️ Tech Stack
* **Frontend:** React, Tailwind CSS (v4), Framer Motion, Socket.io-client
* **Backend:** Node.js, Express.js, Prisma ORM, Socket.io (WebSockets)
* **QA & Testing:** Cypress (End-to-End Testing)
* **Integrations:** Cloudinary (Image Hosting), SlipOK (Bank Slip Verification API), PromptPay QR

---

## ⚙️ How It Works (System Flow)

1. **Donation Initiation:** ผู้ใช้งานกรอกชื่อ ข้อความ และจำนวนเงิน ระบบจะสร้าง PromptPay QR Code ให้แบบ Real-time
2. **Cross-Device Upload:** ผู้ใช้งานสามารถอัปโหลดสลิปได้ 2 ทาง:
   * ลากวางไฟล์ลงเว็บโดยตรง (Drag & Drop)
   * สแกน QR Code เพื่ออัปโหลดรูปจากมือถือ (ระบบใช้ Socket.io เพื่อส่งรูปกลับมาที่หน้าจอคอมพิวเตอร์แบบ Real-time)
3. **Image Processing:** รูปสลิปจะถูกส่งไปฝากไว้ที่ Cloudinary ทันทีเพื่อแปลงเป็น URL
4. **Automated Verification:** Backend ส่ง URL ของสลิปไปตรวจสอบกับ SlipOK API เพื่อยืนยันว่าจำนวนเงินตรงกันและสลิปยังไม่เคยถูกใช้งาน (Prevent Duplicate)
5. **Database & Real-time Update:** หากตรวจสอบผ่าน ระบบจะบันทึกข้อมูลลงฐานข้อมูลผ่าน Prisma และส่ง Event ผ่าน Socket.io กลับไปที่หน้าบ้าน เพื่ออัปเดตหน้า Thank You Page, หลอดเป้าหมายโดเนท (Goal Widget), และเวลา Subathon Timer บนหน้าจอสตรีม

---

## 🧪 QA & Testing Artifacts
นอกจากโค้ด Automation แล้ว ผมยังให้ความสำคัญกับการวางแผนการทดสอบ (Test Planning) เพื่อให้ครอบคลุมกรณีที่มีความเสี่ยงสูง (Risk-Based Testing)

* 🔗 **[คลิกเพื่อดูเอกสาร Test Scenario](https://docs.google.com/spreadsheets/d/17ZZhiba2lVBJ-JpCcFmzaEBL9KdkIBgvVIpu5abslnw/edit?usp=sharing)**

**โครงสร้างการทดสอบอัตโนมัติ (Cypress E2E):**
```text
cypress/
  ├── e2e/
  │   ├── donation-flow.cy.ts      # เทสต์กระบวนการบริจาค
  │   └── real-time-alert.cy.ts    # เทสต์การแจ้งเตือนสตรีมเมอร์
  ├── support/
  │   └── pages/                   # ใช้ Page Object Model (POM)
  │       ├── DonationPage.ts
  │       └── OverlayPage.ts
