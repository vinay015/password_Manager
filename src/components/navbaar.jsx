import { Link } from "react-router-dom";
function Navbaar({ onLogout, isLocked, darkMode, toggleDarkMode }) {

  return (
    <div>
      <nav className={`sticky  m-auto  flex justify-between items-center p-4 h-10 ${darkMode ? "text-white" : "bg-green-300"}`}>

          <div className="hover:scale-105 transition-transform p-4 text-3xl">
            <a href="/">Own_Password</a>
            <span className={`${darkMode ? "text-purple-400" : "text-purple-700"}`}><a href="/">Managers</a></span>
          </div>
          <ul className="flex gap-6">
            <li className="flex gap-2">
              <Link  className="hover:scale-110 transition-transform" to="/home">Home</Link>
              <Link  className="hover:scale-110 transition-transform" to="/about">About</Link>
            </li>
            {!isLocked && (
              <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-400 text-white rounded-full px-4 py-1 text-md hover:scale-110 transition-transform cursor-pointer"
              >
                Logout
              </button>)
              }
            <button
              onClick={toggleDarkMode}
              className={`py-1 rounded-full ${darkMode ? "bg-black-600" : "bg-green-300"} cursor-pointer`}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </ul>
      </nav>
    </div>
  );
}

export default Navbaar;
