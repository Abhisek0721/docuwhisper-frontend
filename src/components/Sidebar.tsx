import { Button, Card } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { deleteDocument } from "../api/queries/documentQueries";
import { useNavigate } from "react-router-dom";

const Sidebar = ({
  uploadedFiles,
  setSelectedDocument,
  refetchAllDocuments
}:
  { uploadedFiles: any[], setSelectedDocument: (document: any) => void, refetchAllDocuments: () => void }
) => {

  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleDelete = async (fileId: string) => {
    try {
      const response = await deleteDocument(fileId);
      if (response?.data) {
        toast.success(response?.message || "File deleted successfully");
        refetchAllDocuments();
      } else {
        toast.error("Failed to delete file");
      }
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };
  return (
    <Card className="w-64 p-4 shadow-lg rounded-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-4">Uploaded Documents</h2>
        <ul className="space-y-2">
          {uploadedFiles.length > 0 ? (
            uploadedFiles.map((file: any) => (
              <li key={file.filename} className="flex justify-between items-center">
                <button
                  onClick={() => setSelectedDocument({ ...file })}
                  className="flex-1 text-left text-sm text-gray-700 truncate hover:text-blue-500 cursor-pointer outline-none rounded p-1"
                >
                  📄 {file.filename}
                </button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(file.id)}
                />
              </li>
            ))
          ) : (
            <p className="text-gray-500">No files uploaded</p>
          )}
        </ul>

        <div className="flex justify-center">
          <Button
            type="default"
            className="mt-10 mx-auto"
            onClick={() => handleLogout()}
          >
            Logout
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default Sidebar;
