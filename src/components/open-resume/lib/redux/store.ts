import { configureStore } from "@reduxjs/toolkit";
import resumeReducer from "@/components/open-resume/lib/redux/resumeSlice";
import settingsReducer from "@/components/open-resume/lib/redux/settingsSlice";

export const store = configureStore({
  reducer: {
    resume: resumeReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
