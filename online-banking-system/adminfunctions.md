1. Admin Penalty Vault
$250.00 mUSDC: Tổng số tiền phạt thu được từ người dùng rút trước hạn.
Đây là khoản phí penalty mà hệ thống giữ lại.
Nút Refresh Penalty Balance: cập nhật lại số dư mới nhất.
🧑‍💼 2. Admin Panel (chỉ dành cho admin)
📊 Thông tin chung:
Vault Balance ($5000.00 mUSDC): Tổng tiền trong vault (dùng để trả lãi).
System Status (Unpaused):
Unpaused: hệ thống hoạt động bình thường
Paused: dừng khẩn cấp (không cho rút tiền)
Fee Receiver: địa chỉ ví nhận tiền phạt (penalty).
📝 3. Plan Management (Quản lý gói gửi tiết kiệm)
➤ Tạo plan mới – createPlan(...)
Tenor (days): thời gian gửi (ví dụ 90 ngày)
APR (bps): lãi suất (basis points, 100 bps = 1%)
Min deposit: số tiền gửi tối thiểu
Max deposit: tối đa (0 = không giới hạn)
Early withdraw penalty (bps): phí rút sớm

👉 Nút Create Plan: tạo gói mới

➤ Cập nhật lãi – updatePlan(planId, newAprBps)
Nhập:
Plan ID
New APR
👉 Nút Update APR: đổi lãi suất
⚠️ Chỉ áp dụng cho người gửi mới, không ảnh hưởng người cũ.
➤ Bật/tắt plan – enablePlan / disablePlan
Enable Plan: cho phép user tham gia
Disable Plan: ngừng nhận người gửi mới
💰 4. Vault Management
➤ Nạp tiền vào vault – fundVault(amount)
Dùng để bổ sung tiền trả lãi
Nhập số USDC → bấm Fund Vault
➤ Rút tiền khỏi vault – withdrawVault(amount)
Admin rút tiền ra (trong giới hạn an toàn)
Nhập số tiền → Withdraw Vault
⚙️ 5. System Controls
➤ Cài ví nhận phí – setFeeReceiver(address)
Nhập địa chỉ ví → Update Fee Receiver
➤ Dừng hệ thống – pause() / unpause()
Pause:
Dừng khẩn cấp
Không cho rút tiền
Unpause:
Mở lại hoạt động bình thường
📋 6. Plan Status

Hiển thị danh sách plan:

#1: ID plan
90 days: kỳ hạn
2.50% APR: lãi suất
Min / Max: giới hạn gửi
Enabled: trạng thái hoạt động
✅ Tóm lại (ý chính đề bài):

App này là hệ thống gửi tiết kiệm crypto (USDC), trong đó:

Admin tạo các gói gửi (plan)
Người dùng gửi tiền → nhận lãi
Rút sớm → bị phạt → tiền phạt vào vault riêng
Admin quản lý:
Lãi suất
Thanh khoản vault
Trạng thái hệ thống