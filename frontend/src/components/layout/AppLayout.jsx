import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const AppLayout = ({ children }) => (
  <div className="min-h-screen bg-slate-50 flex">
    <Sidebar />
    <div className="flex-1 pl-64 flex flex-col min-h-screen">
      <TopBar />
      <main className="p-8 flex-1 flex flex-col">
        {children}
      </main>
    </div>
  </div>
);

export default AppLayout;
