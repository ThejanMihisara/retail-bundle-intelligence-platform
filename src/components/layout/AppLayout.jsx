import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const AppLayout = ({ children }) => (
  <div className="min-h-screen bg-[#f8fafc]">
    <Sidebar />
    <main className="ml-[240px] min-h-screen">
      <TopBar />
      <div className="p-6">{children}</div>
    </main>
  </div>
);

export default AppLayout;
