import { useSearchParams } from "react-router-dom";
import CalcPackagePickerPage from "./CalcPackagePickerPage";
import CalcEngineEditorPage from "./CalcEngineEditorPage";

/** Velger mellom pakkevelger og editor basert på ?package= i URL. */
export default function CalcEngineNewRouter() {
  const [params] = useSearchParams();
  return params.get("package") ? <CalcEngineEditorPage /> : <CalcPackagePickerPage />;
}
