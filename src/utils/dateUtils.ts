import moment from 'moment';

export const datesToDue = (date: string) => {
  const eventDate = moment(date);
  const today = moment();
  return eventDate.diff(today, 'days');
};

export const byDays = (a: object, b: object) => {
  switch(true) {
    case a.days < b.days:
      return -1;
    case a.days > b.days:
      return 1;
    default:
      return 0;
  }
};
