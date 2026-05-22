import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { createMuiTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode((prevMode) => !prevMode);
  };

  const theme = useMemo(
    () =>
      createMuiTheme({
        palette: {
          type: darkMode ? "dark" : "light",
          primary: {
            main: darkMode ? "#66bb6a" : "#43a047",
            light: darkMode ? "#81c784" : "#66bb6a",
            dark: darkMode ? "#388e3c" : "#2e7d32",
            contrastText: "#ffffff"
          },
          secondary: {
            main: darkMode ? "#80cbc4" : "#26a69a",
            light: darkMode ? "#b2dfdb" : "#4db6ac",
            dark: darkMode ? "#4db6ac" : "#00897b",
            contrastText: "#ffffff"
          },
          background: darkMode
            ? {
                default: "#0f1a12",
                paper: "#18251c"
              }
            : {
                default: "#f4fbf4",
                paper: "#ffffff"
              }
        },
      }),
    [darkMode]
  );

  const contextValue = useMemo(() => ({ darkMode, toggleTheme }), [darkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
