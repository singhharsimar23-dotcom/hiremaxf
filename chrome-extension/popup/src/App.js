import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
function App() {
    const [count, setCount] = useState(0);
    return (_jsxs("div", { className: "w-[400px] h-[500px] bg-background text-text-primary p-4 flex flex-col font-sans", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400", children: "HireMax" }), _jsx("div", { className: "w-2 h-2 rounded-full bg-success" })] }), _jsxs("div", { className: "flex-1 flex flex-col items-center justify-center space-y-4", children: [_jsx("div", { className: "text-text-secondary", children: "Environment Ready" }), _jsxs("button", { onClick: () => setCount((count) => count + 1), className: "bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm", children: ["Count is ", count] })] }), _jsx("div", { className: "text-xs text-text-secondary text-center mt-auto pt-4 border-t border-border", children: "v1.0.0 \u2022 HireMax Intelligence" })] }));
}
export default App;
