// Dashboard.jsx
import { useRef, useState, useEffect } from "react";
import { Slide, ToastContainer, toast } from "react-toastify";
import { v4 as uuidb4 } from "uuid";
import "react-toastify/dist/ReactToastify.css";
import Navbaar from "./navbaar";
import Footer from "./Footer";


const Dashboard = () => {
    // Refs
    const passref = useRef();
    const ref = useRef();
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [isLocked, setIsLocked] = useState(true);
    const [isSettingMaster, setIsSettingMaster] = useState(false);
    const [masterPasswordInput, setMasterPasswordInput] = useState("");
    const [cryptoKey, setCryptoKey] = useState(null);
    const [form, setform] = useState({ website: "", username: "", password: "" });
    const [encryptedArray, setEncryptedArray] = useState([]);
    const [decryptedArray, setDecryptedArray] = useState([]);
    const [shake, setShake] = useState(false);
    const [errorFields, setErrorFields] = useState({ website: false, username: false, password: false });
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");


    useEffect(() => {
        localStorage.setItem("darkMode", darkMode);
    }, [darkMode]);
    const toggleDarkMode = () => setDarkMode(prev => !prev);


    // On mount: check if master hash exists and load encrypted entries
    useEffect(() => {
        const savedHash = localStorage.getItem("masterPasswordHash");
        if (!savedHash) setIsSettingMaster(true);

        const enc = localStorage.getItem("password");
        if (enc) {
            try {
                setEncryptedArray(JSON.parse(enc));
            } catch {
                setEncryptedArray([]);
            }
        }
    }, []);

    // Convert ArrayBuffer -> hex string
    const bufToHex = (buffer) =>
        Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Convert ArrayBuffer -> Base64
    const bufToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    };

    // Base64 -> ArrayBuffer
    const base64ToBuf = (b64) => {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    };

    // Hash master password (SHA-256) -> hex
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        return bufToHex(hashBuffer);
    };

    // Generate random salt (base64)
    const generateSaltBase64 = (len = 16) => {
        const salt = crypto.getRandomValues(new Uint8Array(len));
        return bufToBase64(salt.buffer);
    };

    // Derive AES-GCM key from password + salt (salt base64)
    const deriveKeyFromPassword = async (password, saltBase64) => {
        const encoder = new TextEncoder();
        const pwKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        const saltBuf = base64ToBuf(saltBase64);

        // PBKDF2 settings - you can increase iterations for more security at the cost of CPU time
        const key = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: saltBuf,
                iterations: 200000, // strong default for modern machines; reduce if too slow
                hash: "SHA-256",
            },
            pwKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );

        return key; // CryptoKey
    };

    // Encrypt text with AES-GCM, returning base64 cipher and base64 iv
    const encryptText = async (plainText, key) => {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM
        const cipherBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encoder.encode(plainText)
        );
        return { cipher: bufToBase64(cipherBuffer), iv: bufToBase64(iv.buffer) };
    };

    // Decrypt base64 cipher with base64 iv using key -> plaintext
    const decryptText = async (cipherBase64, ivBase64, key) => {
        try {
            const cipherBuf = base64ToBuf(cipherBase64);
            const ivBuf = base64ToBuf(ivBase64);
            const plainBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivBuf },
                key,
                cipherBuf
            );
            const dec = new TextDecoder();
            return dec.decode(plainBuffer);
        } catch (e) {
            // decryption failed
            console.error("Decryption failed:", e);
            return null;
        }
    };

    // Master password

    const handleSetMasterPassword = async () => {
        if (masterPasswordInput.trim().length < 4) {
            toast.error("Master password must be at least 4 characters");
            return;
        }

        // generate salt for key derivation and store it
        const saltBase64 = generateSaltBase64(16);
        localStorage.setItem("masterSalt", saltBase64);

        // store hash of master password for verification later
        const hashed = await hashPassword(masterPasswordInput);
        localStorage.setItem("masterPasswordHash", hashed);

        // derive key and keep it in memory
        const key = await deriveKeyFromPassword(masterPasswordInput, saltBase64);
        setCryptoKey(key);
        // set unlocked
        setIsSettingMaster(false);
        setIsLocked(false);
        setMasterPasswordInput("");
        toast.success("Master password set and unlocked");
        // After unlocking, decrypt any existing entries (if any)
        await decryptAllWithKey(key);
    };

    const handleMasterPasswordSubmit = async () => {
        const savedHash = localStorage.getItem("masterPasswordHash");
        if (!savedHash) {
            toast.error("No master password set");
            return;
        }
        const enteredHash = await hashPassword(masterPasswordInput);
        if (enteredHash !== savedHash) {
            toast.error("Incorrect master password");
            return;
        }

        // Derive key using stored salt
        const saltBase64 = localStorage.getItem("masterSalt");
        if (!saltBase64) {
            toast.error("Missing salt (data corrupted)");
            return;
        }

        const key = await deriveKeyFromPassword(masterPasswordInput, saltBase64);
        setCryptoKey(key);
        setIsLocked(false);
        setMasterPasswordInput("");
        toast.success("Unlocked");
        // decrypt stored entries into memory
        await decryptAllWithKey(key);
    };

    const handleLogout = () => {
        // wipe in-memory key and decrypted data
        setCryptoKey(null);
        setDecryptedArray([]);
        setIsLocked(true);
        setMasterPasswordInput("");
        toast.info("Locked");
    };

    // Encrypt/Decrypt

    // Decrypt all encryptedArray entries using provided key and populate decryptedArray
    const decryptAllWithKey = async (key) => {
        if (!key) return;
        const decPromises = encryptedArray.map(async (entry) => {
            // Each entry has entry.passwordCipher and entry.iv
            const plain = await decryptText(entry.passwordCipher, entry.iv, key);
            return {
                ...entry,
                passwordPlain: plain, // maybe null if decrypt fails
            };
        });
        const results = await Promise.all(decPromises);
        setDecryptedArray(results);
    };

    // Save encryptedArray to localStorage and update state
    const persistEncryptedArray = (arr) => {
        localStorage.setItem("password", JSON.stringify(arr));
        setEncryptedArray(arr);
    };

    // Form actions

    const handleChange = (e) => setform({ ...form, [e.target.name]: e.target.value });

    const showPassword = () => {
        if (ref.current.src.includes("icons/eyecross.png")) {
            ref.current.src = "icons/eye.png";
            passref.current.type = "password";
        } else {
            ref.current.src = "icons/eyecross.png";
            passref.current.type = "text";
        }
    };

    const savePassword = async () => {
        if (!cryptoKey) {
            toast.error("You must unlock the vault before saving.");
            return;
        }
        if (!form.website.trim() || !form.username.trim() || !form.password.trim()) {
            setErrorFields({website: !form.website.trim(),username: !form.username.trim(),password: !form.password.trim()});
            setShake(true);
            setTimeout(() => setErrorFields({ website: false, username: false, password: false }), 2000);
            setTimeout(() => setShake(false), 700);
            toast.error("All fields are required before saving!");
            return;
        }
        else {
            setErrorFields({ website: false, username: false, password: false });
        }

        const duplicate = decryptedArray.find(
            (e) => 
                e.website.toLowerCase() === form.website.toLowerCase() &&
                e.username.toLowerCase() === form.username.toLowerCase() &&
                e.id !== form.id // allow updating same record
        );

        if (duplicate) {
            toast.error("This website and username already exist!");
            return;
        }

        const isEdit = !!form.id; // true when editing existing record
        const id = isEdit ? form.id : uuidb4();

        // Preserve createdAt when updating, and set updatedAt
        const existing = decryptedArray.find((e) => e.id === id);
        const createdAt = existing?.createdAt || new Date().toISOString();

        // Encrypt the password text
        const { cipher, iv } = await encryptText(form.password, cryptoKey);
        const entry = {
            id,
            website: form.website,
            username: form.username,
            passwordCipher: cipher,
            iv: iv,
            createdAt,
            updatedAt: new Date().toISOString()
        };

        const updatedEnc = [...encryptedArray.filter((e) => e.id !== entry.id), entry];
        persistEncryptedArray(updatedEnc);

        // Add decrypted view for UI
        const decryptedEntry = { ...entry, passwordPlain: form.password };
        setDecryptedArray((prev) => [...prev.filter((e) => e.id !== entry.id), decryptedEntry]);

        setform({ website: "", username: "", password: "" });
        toast.success("Password saved (encrypted)");
        setErrorFields({ website: false, username: false, password: false });
    };

    const deletePassword = (id) => {
        if (!confirm("Are you sure want to delete!")) return;
        const updatedEnc = encryptedArray.filter((item) => item.id !== id);
        persistEncryptedArray(updatedEnc);
        setDecryptedArray((prev) => prev.filter((item) => item.id !== id));
        toast.error("Deleted");
    };

    // Edit: populate form with decrypted entry, remove from arrays - edited entry will be re-encrypted on save
    const editPassword = (id) => {
        const entry = decryptedArray.find((e) => e.id === id);
        if (!entry) 
            return toast.error("Entry not found or cannot decrypt");
        setform({ id: entry.id, website: entry.website, username: entry.username, password: entry.passwordPlain || "" });
        toast.info("You can edit and save the entry");
    };

    const copyText = async (text) => {
        if (!text) {
            toast.error("No text to copy");
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Copy failed");
        }
    };

    const toggleVisibility = async (item) => {
        // If already visible → hide immediately
        if (visiblePasswords[item.id]) {
            setVisiblePasswords((prev) => {
                const updated = { ...prev };
                delete updated[item.id];
                return updated;
            });
            return;
        }

        // If already decrypted and cached
        let plain = item.passwordPlain;

        // Otherwise decrypt it
        if (!plain) {
            if (!cryptoKey) {
                toast.error("Unlock the vault first");
                return;
            }

            try {
                plain = await decryptText(item.passwordCipher, item.iv, cryptoKey);
            } catch {
                toast.error("Decryption failed");
                return;
            }
        }

        // Show the password
        setVisiblePasswords((prev) => ({ ...prev, [item.id]: plain }));

        // Hide after 5 seconds (auto-hide)
        setTimeout(() => {
            setVisiblePasswords((prev) => {
                const updated = { ...prev };
                delete updated[item.id];
                return updated;
            });
        }, 5000);
    };


    // Copy password (use visible version if present, else try decrypt)
    const handleCopyPassword = async (item) => {
        const plain = visiblePasswords[item.id] ?? item.passwordPlain;
        if (plain) {
            copyText(plain);
            return;
        }

        if (!cryptoKey) {
            toast.error("Unlock the vault to copy password");
            return;
        }

        const dec = await decryptText(item.passwordCipher, item.iv, cryptoKey);
        if (!dec) {
            toast.error("Decrypt failed");
            return;
        }

        // optionally show it when copying
        setVisiblePasswords(prev => ({ ...prev, [item.id]: dec }));
        // update decrypted array as well
        setDecryptedArray(prev => prev.map(e => (e.id === item.id ? { ...e, passwordPlain: dec } : e)));

        copyText(dec);
    };


    // UI: lock screen shown when locked

    if (isLocked || isSettingMaster) {
        return (<>
            <Navbaar onLogout={handleLogout} isLocked={isLocked} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            <div className={`h-screen flex flex-col items-center justify-center ${darkMode ? " absolute top-0 z-[-2] h-screen w-screen bg-neutral-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-white" : "absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-black"}`}>
                <ToastContainer theme="colored" transition={Slide} />
                <h1 className="text-3xl font-bold mb-4">
                    {isSettingMaster ? "🔑 Set Master Password" : "🔐 Enter Master Password"}
                </h1>

                <input
                    type="password"
                    value={masterPasswordInput}
                    onChange={(e) => setMasterPasswordInput(e.target.value)}
                    placeholder="Master password"
                    className="p-2 rounded-full border border-green-700 bg-transparent w-64 text-center"
                />
                
                <div className="mt-4 flex gap-3">
                    <button
                        onClick={isSettingMaster ? handleSetMasterPassword : handleMasterPasswordSubmit}
                        className="bg-green-600 hover:bg-green-500 rounded-full px-6 py-2"
                    >
                        {isSettingMaster ? "Set Password" : "Unlock"}
                    </button>
                </div>
            </div>
            <Footer darkMode={darkMode} />
        </>
        );
    }

    // Main Dashboard UI (unlocked)

    return (
        <>
            <ToastContainer theme="colored" transition={Slide} />

            <Navbaar onLogout={handleLogout} isLocked={isLocked} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

            <div className={`${darkMode ? "absolute top-0 z-[-2] h-screen w-screen bg-neutral-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-white" : "absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-black"} min-h-screen transition-colors`}>
                <div className="max-w-[700px] m-auto pt-10 mt-2.5">
                    <div className={`flex flex-col gap-3 p-4 items-center${shake ? "animate-shake" : ""} `}>
                        <input
                            className={`rounded-full border border-green-950 p-4 py-2 w-full 
                                ${errorFields.website ? "border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" : ""} 
                                ${shake ? "animate-shake" : ""}
                                `}
                            type="text"
                            placeholder="Enter website URL (example: www.example.com)"
                            name="website"
                            value={form.website}
                            onChange={handleChange}
                        />
                        <div className="flex flex-col md:flex-row w-full justify-between gap-4">
                            <input
                                className={`rounded-full border w-full border-green-900 p-4 py-1 
                                    ${errorFields.username ? "border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" : "border-gray-400"}
                                    ${shake ? "animate-shake" : ""}
                                    `}
                                type="text"
                                placeholder="Enter username here..."
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                            />
                            <div className="relative w-full">
                                <input
                                    className={`rounded-full w-full border border-green-900 p-4 py-1 ${errorFields.password ? "border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" : ""}
                                        ${shake ? "animate-shake" : ""}
                                        `}
                                    type="password"
                                    placeholder="Enter password here..."
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    ref={passref}
                                />
                                <span className="absolute right-2.5 top-1 cursor-pointer" onClick={showPassword}>
                                    <img ref={ref} width={24} src="icons/eye.png" className={`${darkMode ? "invert-100" : "invert-0"}`} />
                                </span>
                            </div>
                        </div>

                        <button onClick={savePassword} className="flex justify-center text-black items-center gap-2 bg-green-300 hover:bg-green-400 rounded-full px-6 py-1.5 border-green-900 cursor-pointer">
                            <lord-icon src="https://cdn.lordicon.com/jgnvfzqg.json"
                                trigger="hover"></lord-icon>
                            {form.id ? "Update" : "Save"}
                        </button>
                    </div>
                </div>


                <div className={`max-w-[900px] m-auto mt-6 rounded-2xl shadow-lg transition-all duration-300 ${darkMode ? "bg-neutral-900 text-white" : "bg-white text-gray-800"}`} >

                    <div className={`flex flex-row justify-between items-start sm:items-center px-4 py-3 border-b ${darkMode ? "border-neutral-700" : "border-green-300"}`}>
                        <h2 className="text-lg md:text-xl font-semibold">🔐 Saved Passwords</h2>
                        <p className="text-sm text-gray-400 mt-1 sm:mt-0"> Total: {decryptedArray.length}</p>
                    </div>

                    {decryptedArray.length === 0 && <div className="text-center text-gray-400 text-sm md:text-base py-6">No Password saved yet.</div>}
                    {decryptedArray.length !== 0 && (

                        <div className=" hidden md:block w-full overflow-x-auto">
                            <table className="table-fixed w-full min-w-xl text-white rounded-md rounded-t-none overflow-hidden border-collapse">

                                <colgroup>
                                    <col className="w-[30%] sm:w-[25%] md:w-[30%]" />
                                    <col className="w-[25%] sm:w-[25%] md:w-[25%]" />
                                    <col className="w-[25%] sm:w-[25%] md:w-[25%]" />
                                    <col className="w-[20%] sm:w-[25%] md:w-[20%]" />
                                </colgroup>

                                <thead className={`sticky top-0 z-10  text-center ${darkMode ? "bg-neutral-800 text-white" : "bg-green-700 text-white"}`}>
                                    <tr>
                                        <th className="py-2 px-2  text-sm md:text-base font-medium">Website</th>
                                        <th className="py-2 px-2  text-sm md:text-base font-medium">Username</th>
                                        <th className="py-2 px-2  text-sm md:text-base font-medium">Password</th>
                                        <th className="py-2 px-2  text-sm md:text-base font-medium">Action</th>
                                    </tr>
                                </thead>

                                <tbody className={`${darkMode ? "bg-neutral-800 text-white" : "bg-green-200 text-black"}`}>
                                    {decryptedArray.map((item) => (
                                        <tr key={item.id} className={`border-t ${darkMode ? "hover:bg-neutral-700" : "hover:bg-green-100"} transition-all `}>
                                            <td className="py-3 px-3 truncate max-w-[200px]">
                                                <div className="flex justify-between items-center">
                                                    <a className="truncate hover:underline pl-2" href={item.website} target="_blank" rel="noreferrer">
                                                        {item.website}
                                                    </a>
                                                    <div className={`cursor-pointer ml-2 ${darkMode ? "invert" : ""}`} title="Copy" onClick={() => copyText(item.website)}>
                                                        <lord-icon style={{ width: "22px", height: "22px", paddingTop: "3px" }}
                                                            src="https://cdn.lordicon.com/iykgtsbt.json"
                                                            trigger="hover"></lord-icon>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 truncate max-w-[200px]">
                                                <div className="flex justify-between items-center">
                                                    <span className="truncate">{item.username}</span>
                                                    <div className={`cursor-pointer ml-2  ${darkMode ? "invert" : ""}`}
                                                        title="Copy"
                                                        onClick={() => copyText(item.username)}>
                                                        <lord-icon style={{ width: "22px", height: "22px", paddingTop: "3px" }} src="https://cdn.lordicon.com/iykgtsbt.json" trigger="hover"></lord-icon>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-3 py-3 ">
                                                <div className="flex justify-around items-center">
                                                    <span>
                                                        {visiblePasswords[item.id] ? visiblePasswords[item.id] : "••••••••••••••••"}
                                                    </span>
                                                    <div className={`flex items-center gap-2 ${darkMode ? "invert" : ""}`}>
                                                        <img
                                                            src={visiblePasswords[item.id] ? "icons/eyecross.png" : "icons/eye.png"}
                                                            alt={visiblePasswords[item.id] ? "Hide password" : "Show password"}
                                                            width={20}
                                                            className="cursor-pointer"
                                                            title="Show password"
                                                            onClick={() => toggleVisibility(item)}
                                                        />

                                                        <div className="cursor-pointer" title="Copy" onClick={() => handleCopyPassword(item)}>
                                                            <lord-icon
                                                                style={{ width: "22px", height: "22px", paddingTop: "3px" }}
                                                                src="https://cdn.lordicon.com/iykgtsbt.json"
                                                                trigger="hover"
                                                            ></lord-icon>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-center ">
                                                <div className={`flex justify-center gap-12  ${darkMode ? "invert" : ""}`}>
                                                    <span className="cursor-pointer" title="Edit" onClick={() => editPassword(item.id)}>
                                                        <lord-icon src="https://cdn.lordicon.com/gwlusjdu.json" trigger="hover" style={{ width: "22px", height: "22px" }}></lord-icon>
                                                    </span>
                                                    <span className="cursor-pointer" title="Delete" onClick={() => deletePassword(item.id)}>
                                                        <lord-icon src="https://cdn.lordicon.com/skkahier.json" trigger="hover" style={{ width: "22px", height: "22px" }}></lord-icon>
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ======= Mobile/Tablet ACCORDION View ======= */}
                <div className="md:hidden divide-y divide-gray-300 dark:divide-neutral-800">
                    {decryptedArray.length === 0 ? (
                        <p className="text-center py-6 text-gray-400 italic">
                            No passwords saved yet.
                        </p>
                    ) : (
                        decryptedArray.map((item) => (
                            <details
                                key={item.id}
                                className={`group transition-all ${darkMode
                                    ? "bg-neutral-900 hover:bg-neutral-800"
                                    : "bg-white hover:bg-green-50"
                                    }`}
                            >
                                <summary
                                    className="flex justify-between items-center px-4 py-3 cursor-pointer select-none"
                                >
                                    <div>
                                        <p className="font-semibold truncate">{item.website}</p>
                                        <p className="text-sm text-gray-500 truncate">{item.username}</p>
                                    </div>
                                    <span className="text-gray-400 group-open:rotate-180 transition-transform">
                                        ▼
                                    </span>
                                </summary>

                                {/* Accordion content */}
                                <div className="px-5 pb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-500">Password:</span>
                                        <span className="font-mono">
                                            {visiblePasswords[item.id]
                                                ? visiblePasswords[item.id]
                                                : "••••••••"}
                                        </span>
                                    </div>

                                    <div className="flex gap-4 justify-center mt-2">
                                        {/* Toggle Password */}
                                        <button
                                            onClick={() => toggleVisibility(item)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${darkMode
                                                ? "bg-neutral-800 hover:bg-neutral-700"
                                                : "bg-green-600 hover:bg-green-700 text-white"
                                                }`}
                                        >
                                            👁️ {visiblePasswords[item.id] ? "Hide" : "Show"}
                                        </button>

                                        {/* Copy */}
                                        <button
                                            onClick={() => handleCopyPassword(item)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${darkMode
                                                ? "bg-neutral-800 hover:bg-neutral-700"
                                                : "bg-green-600 hover:bg-green-700 text-white"
                                                }`}
                                        >
                                            📋 Copy
                                        </button>

                                        {/* Edit */}
                                        <button
                                            onClick={() => editPassword(item.id)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${darkMode
                                                ? "bg-neutral-800 hover:bg-neutral-700"
                                                : "bg-blue-600 hover:bg-blue-700 text-white"
                                                }`}
                                        >
                                            ✏️ Edit
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => deletePassword(item.id)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${darkMode
                                                ? "bg-neutral-800 hover:bg-neutral-700"
                                                : "bg-red-600 hover:bg-red-700 text-white"
                                                }`}
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                            </details>
                        ))
                    )}
                </div>
            </div>
            <Footer darkMode={darkMode} />
        </>
    );
};

export default Dashboard;
