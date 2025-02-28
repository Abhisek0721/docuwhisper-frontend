import { Button, Card, Typography } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setUserAccessToken } from "../utils/localStorageUtils";
import { envConstant } from "../constants";
const { Title, Text } = Typography;

const Login = () => {

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const user = params.get("user");

    if (token && user) {
      setUserAccessToken(token, JSON.parse(user));
      navigate("/");
    }
  }, [location, navigate]);

  const handleGoogleSignIn = () => {
    window.location.href = `${envConstant.BACKEND_BASE_URL}/auth/google`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="p-8 shadow-lg rounded-2xl max-w-sm text-center">
        <Title level={3}>Welcome to DocuWhisper</Title>
        <Text type="secondary">Sign in to continue</Text>
        <div className="mt-6">
          <Button 
            type="primary" 
            icon={<GoogleOutlined />} 
            size="large" 
            className="w-full bg-red-500 hover:bg-red-600"
            onClick={handleGoogleSignIn}
          >
            Sign in with Google
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;