import { useState } from 'react';
import { Button } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

// Define props type for the component
interface GoogleDrivePickerProps {
  onFileSelect: (file: File) => void;
  buttonText?: string;
}

// Script loading utility
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err: any) => reject(err);
    document.body.appendChild(script);
  });
};

const GoogleDrivePickerButton: React.FC<GoogleDrivePickerProps> = ({ 
  onFileSelect, 
  buttonText = "Upload from Google Drive" 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Load the Google Picker API
  const loadGoogleDriveAPI = async () => {
    try {
      await loadScript('https://apis.google.com/js/api.js');
      await loadScript('https://apis.google.com/js/platform.js');
    } catch (error: any) {
      console.error('Error loading Google Drive API:', error);
    }
  };

  // Google Login with OAuth
  const googleLogin = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        // Make sure Google Picker API is loaded
        await loadGoogleDriveAPI();
        
        // Load the picker API
        if (!window.google?.picker) {
          await new Promise<void>((resolve) => {
            window.gapi.load('picker', { callback: resolve });
          });
        }

        const accessToken = tokenResponse.access_token;
        
        // Create and render the picker
        const picker = new window.google.picker.PickerBuilder()
          .addView(window.google.picker.ViewId.DOCS)
          .addView(window.google.picker.ViewId.PDFS) // Filter to show only PDFs
          .setOAuthToken(accessToken)
          .setCallback(async (data: any) => {
            if (data.action === 'picked') {
              const pickedFile = data.docs[0];
              await downloadFileFromGoogleDrive(pickedFile, accessToken);
            }
            setIsLoading(false);
          })
          .build();
        
        picker.setVisible(true);
      } catch (error) {
        console.error('Error initializing Google Picker:', error);
        setIsLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error('Google login failed:', errorResponse);
      setIsLoading(false);
    },
  });

  // Function to download the file from Google Drive
  const downloadFileFromGoogleDrive = async (fileData: any, accessToken: string) => {
    try {
      // Get the file content directly
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileData.id}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'blob'
        }
      );

      // Convert the blob to a File object to match your existing upload flow
      const fileBlob = response.data;
      const fileName = fileData.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      // Create a File object that can be used just like a file from an input
      const file = new File([fileBlob], fileName, { 
        type: fileExtension === 'pdf' ? 'application/pdf' : fileData.mimeType 
      });

      // Pass the File object to the parent component's handler
      onFileSelect(file);
    } catch (error) {
      console.error('Error downloading file from Google Drive:', error);
    }
  };

  return (
    <Button 
      icon={<GoogleOutlined />} 
      onClick={() => googleLogin()}
      loading={isLoading}
    >
      {buttonText}
    </Button>
  );
};

export default GoogleDrivePickerButton;