import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MemberAuthProvider } from "./contexts/MemberAuthContext";

// User Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import QRScan from "./pages/QRScan";
import Attendance from "./pages/Attendance";
import MyAttendance from "./pages/MyAttendance";
import Swap from "./pages/Swap";
import Manual from "./pages/Manual";
import Items from "./pages/Items";
import Schedule from "./pages/Schedule";
import RentalBusiness from "./pages/RentalBusiness";

// Admin Pages
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminMembers from "./pages/admin/Members";
import AdminSwaps from "./pages/admin/Swaps";
import AdminQRCode from "./pages/admin/QRCode";
import AdminQRManagement from "./pages/admin/QRManagement";
import AdminAttendance from "./pages/admin/Attendance";
import AdminSchedules from "./pages/admin/Schedules";
import AdminItems from "./pages/admin/Items";
import AdminManuals from "./pages/admin/Manuals";
import AdminCategories from "./pages/admin/Categories";
import AdminRentalSettings from "./pages/admin/RentalSettings";

function Router() {
  return (
    <Switch>
      {/* User Routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/qr-scan" component={QRScan} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/my-attendance" component={MyAttendance} />
      <Route path="/swap" component={Swap} />
      <Route path="/manual" component={Manual} />
      <Route path="/items" component={Items} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/rental-business" component={RentalBusiness} />

      {/* Admin Routes */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/members" component={AdminMembers} />
      <Route path="/admin/swaps" component={AdminSwaps} />
      <Route path="/admin/qr" component={AdminQRCode} />
      <Route path="/admin/qr-management" component={AdminQRManagement} />
      <Route path="/admin/attendance" component={AdminAttendance} />
      <Route path="/admin/schedules" component={AdminSchedules} />
      <Route path="/admin/items" component={AdminItems} />
      <Route path="/admin/manuals" component={AdminManuals} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/rental-settings" component={AdminRentalSettings} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <MemberAuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </MemberAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
