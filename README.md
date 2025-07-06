
# News Compass: AI-Powered News Analysis Platform

![News Compass Banner](https://placehold.co/1200x400.png?text=News+Compass)
<p align="center">
  <em>Understand news with AI-powered insights, bias assessment, and multi-perspective analysis.</em>
</p>

---

**News Compass** is a modern web application designed to help users navigate the complex landscape of online news. Instead of just aggregating headlines, it provides a deeper layer of context by using AI to summarize articles, assess political bias, and identify related stories from different sources. This encourages critical thinking and a more comprehensive understanding of current events.

## &#128295; Core Features

-   **AI-Powered Summarization**: Get concise, AI-generated summaries of news articles, allowing you to grasp key points quickly.
-   **Political Bias Assessment**: Each article is analyzed by an AI to provide a bias rating (Left, Center, Right) along with a detailed explanation for the assessment.
-   **Curated News Feed**: View articles from multiple administrator-defined RSS feeds in a clean, chronological layout.
-   **Advanced Filtering & Sorting**: Easily filter the news feed by bias rating or search term, and sort articles by date or source name.
-   **Lateral Reading & Similarity Linking**: The app automatically identifies and links articles that cover the same core event, making it easy to compare how different sources report on the same story.
-   **Integrated Blog Platform**: Admins can "promote" a saved article analysis to create a full-fledged blog post, adding their own insights or commentary.
-   **Comprehensive Admin Panel**: A secure area for administrators to:
    -   Manage RSS feed sources (add, edit, delete, import/export).
    -   Manually analyze article content or URLs.
    -   View, manage, and re-analyze all saved article analyses.
    -   Manage user accounts and roles (Super Admin only).
    -   Configure system-wide settings like data sources and search parameters.

## &#129504; Why Choose News Compass?

In an era of information overload and rampant misinformation, News Compass provides tools to build a more informed perspective.

-   **Combat Echo Chambers**: By presenting news from various sources and explicitly labeling their bias, the app encourages you to engage with different viewpoints.
-   **Promote Media Literacy**: Understanding the bias and framing of a story is a key component of media literacy. News Compass makes this transparent.
-   **Save Time**: AI summaries and neutral perspectives give you the gist of a story without needing to read multiple full-length articles.
-   **Deepen Understanding**: The "similar articles" feature provides immediate context, showing you the bigger picture of how an event is being covered.

## &#128225; Technology Stack

This application is built with a modern, robust, and scalable tech stack.

-   **Framework**: [Next.js](https://nextjs.org/) (using the App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **AI Integration**: [Google's Genkit](https://firebase.google.com/docs/genkit)
-   **UI**: [React](https://reactjs.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Component Library**: [ShadCN UI](https://ui.shadcn.com/)
-   **Data Persistence**: Local File System (`.csv` files). This is designed for simplicity in this reference implementation. For a production environment, this should be replaced with a robust database (see FAQ).

---

## &#128640; Getting Started

Follow these instructions to get a local copy of News Compass up and running.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later recommended)
-   `npm` or `yarn` package manager

### Setup and Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/news-compass.git
    cd news-compass
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables**
    This application uses Google's Genkit for its AI features, which requires an API key from Google AI Studio.

    -   Create a `.env` file in the root of the project by copying the example:
        ```bash
        cp .env.example .env
        ```
    -   Visit [Google AI Studio](https://aistudio.google.com/) to generate an API key.
    -   Open your `.env` file and add your API key:
        ```
        GOOGLE_API_KEY=your_google_ai_studio_api_key_here
        ```

4.  **Run the Development Servers**
    You need to run two separate development servers concurrently in two different terminal windows.

    -   **Terminal 1: Run the Next.js App**
        ```bash
        npm run dev
        ```
        Your application will be available at `http://localhost:3000`.

    -   **Terminal 2: Run the Genkit AI Server**
        This server handles the AI flows (summarization, bias assessment, etc.).
        ```bash
        npm run genkit:watch
        ```
        This will start the Genkit development server and watch for changes in your AI flow files.

## &#9881;&#65039; Configuration

The application's behavior can be configured via the Admin Panel.

-   **RSS Feeds**: Navigate to `/admin/feeds` to add, edit, or delete the RSS feeds that provide the news content. You can also import/export feed lists.
-   **System Settings**: Navigate to `/admin/settings` to control:
    -   **Data Source**: Switch between live RSS feeds and mock data.
    -   **Performance**: Adjust limits for global search operations (e.g., max feeds to check, articles per feed, request timeouts).
-   **User Roles (for testing)**: To test different access levels (e.g., User, Admin, SuperAdmin), you can modify the mock user object in the relevant page files (e.g., `src/app/(authenticated)/admin/page.tsx`). In a real application, this would be handled by a proper authentication system.

---

## &#10067; FAQ

**Q: How is the political bias determined?**
A: Bias is determined by a Genkit AI flow that analyzes the full content of an article. The AI model has been prompted to assess language, framing, and topic focus to assign a 'Left', 'Center', or 'Right' score and provide a brief justification. It's a tool for guidance and not an absolute measure.

**Q: How does the "similar articles" feature work?**
A: When a new article is analyzed and saved, its content is compared against other recently saved articles using another AI flow (`assessTextPairSimilarity`). This flow is prompted to look for semantic similarity (i.e., articles discussing the same core event), even if the exact wording or headlines differ.

**Q: The app uses CSV files for data. Can I use a real database?**
A: Absolutely. The file-based storage is a simple, dependency-free way to demonstrate the app's functionality. To switch to a database (like PostgreSQL, MongoDB, or Firebase Firestore), you would need to:
1.  Set up your database schema.
2.  Update the functions in the `src/actions/` directory (e.g., `articleActions.ts`, `feedActions.ts`). Instead of reading/writing to CSV files, these functions would perform CRUD operations on your database.
3.  The rest of the application (the UI components and pages) will work without changes, as they are decoupled from the data layer via the Server Actions.

**Q: How do I add a new AI capability, like topic tagging?**
A: You would follow the existing pattern:
1.  Create a new AI flow file in `src/ai/flows/` (e.g., `tag-article-topics.ts`) using Genkit's `ai.defineFlow` and `ai.definePrompt`.
2.  Create a new server action in `src/actions/` that calls your new flow.
3.  Update the relevant UI components to call the new server action and display the results.
4.  Register your new flow in `src/ai/dev.ts`.

## &#128101; Contributing

Contributions are welcome! If you have suggestions for improvements or want to fix a bug, please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourAmazingFeature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some YourAmazingFeature'`).
5.  Push to the branch (`git push origin feature/YourAmazingFeature`).
6.  Open a Pull Request.

## &#128220; License

This project is licensed under the MIT License. See the `LICENSE` file for details.
