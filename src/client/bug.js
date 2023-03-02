import React from "react";

const f0 = () => {
  return ["a", "b", "c"];
};

const f1 = (d) => {
  const h = d.map((item) => <p key={item}>{item}</p>);
  return h;
};

const f2 = (d) => {
  const h = d.map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ));
  return h;
};

const f3 = (d) => {
  const h = d.map((item) => (
    <ul key={item} value={item}>
      {item}
    </ul>
  ));
  return h;
};

const MyBug = () => {
  return (
    <div>
      <br />
      f1:&nbsp;
      {f1(f0())}
      <br />
      f2:&nbsp;
      {f2(f0())}
      <br />
      f3:&nbsp;
      {f3(f0())}
    </div>
  );
};

export { MyBug };
