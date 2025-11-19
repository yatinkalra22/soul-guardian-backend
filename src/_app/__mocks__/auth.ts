export const verify = async (c: any, next: any) => {
  c.env.jwt = {
    payload: {
      sub: 'user-123',
    },
  };
  await next();
};

export const authorize = async (c: any, next: any) => {
  await next();
};
