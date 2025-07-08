# ScientificTranslator

ScientificTranslator is a modern web application designed to help researchers, students, and professionals translate scientific texts with high accuracy while preserving document structure. Powered by GenAI, it provides seamless translation into multiple languages, ensuring that complex information is accessible across linguistic barriers.

## Core Features

-   **AI-Powered Translation**: Leverages advanced AI models to translate scientific texts, maintaining context and technical accuracy.
-   **Multiple Language Support**: Select from a wide range of target languages for your translation needs.
-   **File Upload**: Easily upload your documents in text format. The UI is prepared for future support of PDF, DOCX, and other formats.
-   **Side-by-Side View**: Compare the original text and the translated output in a clean, intuitive interface.
-   **PDF Export**: Download the translated document as a PDF file with a single click.
-   **Responsive Design**: A clean, accessible, and responsive interface that works on all devices.

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   Node.js (v18 or later)
-   npm, yarn, or pnpm

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/ScientificTranslator.git
    cd ScientificTranslator
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    An empty `.env` file has been created for you. Add your Google API key to it:
    ```
    GOOGLE_API_KEY=YOUR_API_KEY_HERE
    ```
    You can get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Deployment

This application is configured for easy deployment using Docker.

### Docker

1.  **Build the Docker image:**
    ```bash
    docker build -t scientific-translator .
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -p 9002:9002 -d scientific-translator
    ```
The application will be available at `http://localhost:9002`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
