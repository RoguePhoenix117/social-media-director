import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Post } from "./components/Post";
import { EmptyRoute } from "./components/EmptyRoute";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "draft", Component: EmptyRoute },
      { path: "post", Component: Post },
      { path: "monitor", Component: EmptyRoute },
      { path: "stats", Component: EmptyRoute },
      { path: "settings", Component: Settings },
    ],
  },
]);
