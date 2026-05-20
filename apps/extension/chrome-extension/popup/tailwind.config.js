/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0B0F1A",
                card: "#161B2E",
                border: "#2D313D",
                primary: "#3B82F6",
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444",
                text: {
                    primary: "#FFFFFF",
                    secondary: "#94A3B8"
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
