import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardMedecinGeneralisteComponent } from './dashboard-medecin-generaliste.component';

describe('DashboardMedecinGeneralisteComponent', () => {
  let component: DashboardMedecinGeneralisteComponent;
  let fixture: ComponentFixture<DashboardMedecinGeneralisteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardMedecinGeneralisteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardMedecinGeneralisteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
