# Donation Platform (In Progress)

📝 **About the Project**
แพลตฟอร์มรับบริจาคสำหรับสตรีมเมอร์ (กำลังอยู่ในช่วงพัฒนา) โดยโปรเจกต์นี้ให้ความสำคัญกับการทำ Automated Testing ควบคู่ไปกับการพัฒนา (Shift-Left Testing) เพื่อควบคุมคุณภาพของระบบตั้งแต่เริ่มต้น

---

## 🛠️ Tech Stack
* **Frontend/Backend:** TypeScript, React, Node.js
* **QA & Testing:** Cypress (End-to-End Testing)

---

## 🧪 QA & Testing Artifacts
นอกจากโค้ด Automation แล้ว ผมยังให้ความสำคัญกับการวางแผนการทดสอบ (Test Planning) เพื่อให้ครอบคลุมกรณีที่มีความเสี่ยงสูง (Risk-Based Testing)

* 🔗 **[คลิกเพื่อดูเอกสาร Test Scenario (https://docs.google.com/spreadsheets/d/1FwKxyuA_PvCbafsbN_n3bVKhVTvN0wdrACsJjF40L_g/edit?usp=sharing)]**

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
