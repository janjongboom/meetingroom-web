var zus = [[1,2], [2, 3], [3, 5], [6, 8]];

console.log(
  zus.reduce(function (curr, item, ix) {
    console.log(ix, 'curr', curr, 'item', item);
    if (!curr.length) {
      curr.push(item);
      return curr;
    }

    if (curr[curr.length-1][1] === item[0]) {
      curr[curr.length-1][1] = item[1];
    }
    else {
      curr.push(item);
    }
    return curr;
  }, [])
  );