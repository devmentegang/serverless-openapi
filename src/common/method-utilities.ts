export function filterMethods(methods: any) {
    const acceptableMethods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "head",
      "options"
    ];

    return Object.keys(methods)
      .filter(method => acceptableMethods.includes(method))
      .reduce((acc, p) => {
        return { ...acc, [p]: methods[p] };
      }, {});
}