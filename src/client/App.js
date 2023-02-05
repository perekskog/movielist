import { useRef, useState, useCallback, useEffect } from "react";
import axios from "axios";

// Read query parameter chatserver and store in serverUri

// Get the query string from the URL
const queryString = window.location.search;

// Parse the query string to get the value of chatserver
const urlParams = new URLSearchParams(queryString);
const serverUri = urlParams.get("chatserver");

const Message = (props) => {
  console.log("###Message refreshing");

  return (
    <div
      className={
        props.sender === "left"
          ? "message message-left"
          : "message message-right"
      }
    >
      {props.text}
    </div>
  );
};

const MessageList = (props) => {
  console.log("###MessageList refreshing");

  const messages = props.messages;

  return (
    <div className="message-list">
      {messages.map((m) => (
        <Message key={m.id} sender={m.sender} text={m.message} />
      ))}
    </div>
  );
};

const MessageInputState = (props) => {
  console.log("###MessageInputState refreshing");

  const appendMessage = props.appendMessage;

  const [message, setMessage] = useState("");

  const formHandler = useCallback(
    (event) => {
      event.preventDefault();
      console.log("SubmitState:", message);
      appendMessage({ text: message });
      setMessage("");
    },
    [appendMessage, message]
  );
  return (
    <form onSubmit={formHandler}>
      <div className="input-group">
        <input
          className="form-control"
          value={message}
          type="text"
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Send
        </button>
      </div>
    </form>
  );
};

const MessageInputRef = (props) => {
  console.log("###MessageInputRef refreshing");

  const appendMessage = props.appendMessage;

  const messageElement = useRef();

  const formHandler = useCallback(
    (event) => {
      event.preventDefault();
      console.log("SubmitRef:", messageElement.current?.value);
      appendMessage({ text: messageElement.current?.value });
      messageElement.current.value = "";
    },
    [appendMessage]
  );

  return (
    <form onSubmit={formHandler}>
      <div className="input-group">
        <input className="form-control" ref={messageElement} type="text" />
        <button className="btn btn-primary" type="submit">
          Send
        </button>
      </div>
    </form>
  );
};

const detectIntent = async (message) => {
  try {
    console.log(serverUri);
    const response = await axios.post(serverUri + "/detectIntent", message);
    return response;
  } catch (error) {
    console.log(error);
  }
};

const App = () => {
  console.log("###App refreshing");

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();

  useEffect(() => {
    const getMessage = async () => {
      console.log(serverUri);
      const res = await axios.get(serverUri + "/message");
      setMessage(() => res.data.messageOfTheDay);
    };

    getMessage();
  }, [message]);

  const appendMessage = (message) => {
    detectIntent(message).then((response) => {
      console.log(JSON.stringify(response));
      const l = messages.length;
      setMessages((messages) => {
        return [
          ...messages,
          { id: l + 1, sender: "left", message: message.text },
        ];
      });
      setMessages((messages) => {
        return [
          ...messages,
          { id: l + 2, sender: "right", message: response.data.fullfilment },
        ];
      });
    });
  };

  return (
    <div className="app">
      <div className="card motd">
        <div className="card-body">
          <h5 className="card-title" style={{ textAlign: "center" }}>
            Message of the day
          </h5>
          <p className="card-text" style={{ textAlign: "center" }}>
            {message}
          </p>
        </div>
      </div>
      <div>
        <MessageList messages={messages} />
      </div>
      <div>
        <MessageInputRef appendMessage={appendMessage} />
      </div>
      <div>
        <MessageInputState appendMessage={appendMessage} />
      </div>
    </div>
  );
};

export { App };
