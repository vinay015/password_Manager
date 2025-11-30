

const Footer = ({ darkMode }) => {
  return (
    <>

      <footer className={`${darkMode ? "text-white" : "bg-green-900 text-white"} w-full m-auto flex  flex-wrap justify-center items-center px-2 fixed bottom-0`}>
        <div className="p-2 ">
          Password
          <span className="text-purple-700"> Manager</span>
        </div>
        <div className='text-white text-sm md:text-base flex justify-center'>
          Created with <img width={24} src="icons/heart.png" alt="heart" /> by Vinay Pratap.
        </div>
      </footer>
    </>
  )
}

export default Footer