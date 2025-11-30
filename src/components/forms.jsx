import { useState, } from "react"

const Form = () => {
    const [form, setform] = useState({ website: "", username: "", password: "" })

    const handleChange = (e) => {
        setform({...Form, [e.target.name]: e.target.value})
    }
    console.log(form)


    return (
        <>
            <div  className="max-w-[700px] m-auto pt-10 mt-2.5">
                <input
                    className={`rounded-full border-1 border-green-950 p-4 py-2 w-full`}
                    type="text"
                    placeholder="Enter website URL (example: www.example.com)"
                    name="website"
                    value={form.website}
                    onChange={handleChange}
                />
                <input
                    className={`rounded-full border-1 border-green-950 p-4 py-2 w-full`}
                    type="text"
                    placeholder="Enter username)"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                />
                <input
                    className={`rounded-full border-1 border-green-950 p-4 py-2 w-full`}
                    type="text"
                    placeholder="Enter password)"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                />
            </div>
        </>
    )
}

export default Form
