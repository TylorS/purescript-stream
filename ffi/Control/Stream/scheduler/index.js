import { ClockTimer } from './ClockTimer'
import { Scheduler } from './Scheduler'
import { Timeline } from './Timeline'
import { curry2 } from '@most/prelude'

export { endTask, eventTask } from './PropagateTask'

export const defaultScheduler = new Scheduler(new ClockTimer(), new Timeline())

export const scheduleTasks = curry2((tasks, scheduler) => {
  const scheduledTasks = tasks.map(task => scheduler.asap(task))

  return {
    dispose: () => scheduledTasks.forEach(task => task.dispose())
  }
})
