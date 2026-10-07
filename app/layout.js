export const metadata = {
  title: 'สุกี้ผีน้อย',
  description: 'ระบบสั่งอาหารร้านบุฟเฟต์สุกี้ผีน้อย',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: 'sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
