'useclient'
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I am the Rate My Professor support assistant. How can I helo you today?"
    }
  ])
  const [message, setMessage] = useState('')
  const setMessage = async () => {
    setMessages((messages) => [
      ...messages,
      { role: "user", content: message }
      { role: "assitant", content: '' }
    ])


    setMessage = ('')
    const response = 
  }
  return (
  );
}