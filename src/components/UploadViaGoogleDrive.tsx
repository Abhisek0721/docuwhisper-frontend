import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';

declare global {
  interface Window {
    gapi: any;
    google: any;
    onPickerApiLoad: () => void;
  }
}

interface GoogleDrivePickerProps {
  onFileSelect?: (files: any[]) => void;
  buttonText?: string;
  icon?: React.ReactNode;
  className?: string;
}

const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({
  onFileSelect,
  buttonText = "Upload from Google Drive",
  icon = <CloudUploadOutlined />,
  className = "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
}) => {
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Replace with your actual Google API credentials
  const API_KEY = 'AIzaSyB0000000000000000000000000000000';
  const CLIENT_ID = '377122937569-71bsbapcnh0a8ct9a7ahbt884s7v6vvs.apps.googleusercontent.com';
  const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

  useEffect(() => {
    // Load the Google API client library
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleApi;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initGoogleApi = () => {
    window.gapi.load('client:auth2', () => {
      window.gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
      }).then(() => {
        setIsApiLoaded(true);
        updateSigninStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
        window.gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      }).catch((error: any) => {
        console.error('Error initializing Google API client', error);
      });
    });
  };

  const updateSigninStatus = (isSignedIn: boolean) => {
    setIsAuthorized(isSignedIn);
  };

  const handleClick = () => {
    if (!isApiLoaded) return;
    
    if (!isAuthorized) {
      window.gapi.auth2.getAuthInstance().signIn().then(() => {
        if (window.gapi.auth2.getAuthInstance().isSignedIn.get()) {
          loadPicker();
        }
      });
    } else {
      loadPicker();
    }
  };

  const loadPicker = () => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js?onload=onPickerApiLoad';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    
    window.onPickerApiLoad = () => {
      window.gapi.load('picker', createPicker);
    };
  };

  const createPicker = () => {
    const token = window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
    
    if (!token) {
      console.error('No access token available');
      return;
    }
    
    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    const picker = new window.google.picker.PickerBuilder()
      .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setAppId(CLIENT_ID.split('-')[0])
      .setOAuthToken(token)
      .addView(view)
      .addView(new window.google.picker.DocsUploadView())
      .setDeveloperKey(API_KEY)
      .setCallback(pickerCallback)
      .build();
      
    picker.setVisible(true);
  };

  const pickerCallback = (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const files = data.docs;
      if (onFileSelect) {
        onFileSelect(files);
      }
    }
  };

  return (
    <Button 
      onClick={handleClick}
      className={className}
      icon={icon}
      disabled={!isApiLoaded}
    >
      {buttonText}
    </Button>
  );
};

export default GoogleDrivePicker;