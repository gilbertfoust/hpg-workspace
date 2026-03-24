import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, LogIn } from "lucide-react";

const HPG_LOGO_URL =
  "https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-6">
        <img
          src={HPG_LOGO_URL}
          alt="Humanity Pathways Global"
          className="h-16 mx-auto object-contain"
        />
        <div>
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/dashboard")} variant="default">
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={() => navigate("/auth")} variant="outline">
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
